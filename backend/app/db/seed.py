"""
Loads/regenerates the demo dataset into the database.

Call seed() to:
1. Wipe and recreate all tables (ensures clean schema with all columns)
2. Generate synthetic invoices, vendor master, and ledger CSV files
3. Load vendors and ledger entries into DB
4. Run every generated PDF invoice through the ACTUAL orchestrator pipeline
   (real extraction, real risk scoring, real ticket creation, real folder assignment)

This is idempotent and deterministic (fixed random seed in generate_invoices.py).
"""
import os
import sys
import logging
import datetime as dt

logger = logging.getLogger(__name__)

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pandas as pd
from app.db.database import SessionLocal, Base, engine
from app.models.invoice import Invoice
from app.models.ticket import Ticket
from app.models.vendor import Vendor
from app.models.ledger_entry import LedgerEntry
from app.models.folder import Folder
from app.ingestion.batch_handler import process_batch
from app.orchestrator import process_invoice

from synthetic_data.generate_vendor_master import generate_vendor_master
from synthetic_data.generate_ledger import generate_ledger
from synthetic_data.generate_invoices import generate_invoices, INVOICES_DIR, OUTPUT_DIR


def seed():
    print("=" * 60)
    print("DEMO DATASET RESET — Invoice Risk Scanner")
    print("=" * 60)

    # Step 1: Regenerate synthetic data files
    print("\n[1/5] Generating synthetic datasets (vendor master, ledger, invoices)...")
    generate_vendor_master()
    generate_ledger()
    generate_invoices()

    # Step 2: Wipe and recreate all DB tables (guarantees schema is current)
    print("\n[2/5] Resetting database (drop + recreate all tables)...")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    print("      Database tables recreated with current schema.")

    db = SessionLocal()
    try:
        # Step 3: Seed Vendor Master
        vm_path = os.path.join(OUTPUT_DIR, "vendor_master.csv")
        if os.path.exists(vm_path):
            vm_df = pd.read_csv(vm_path)
            for _, row in vm_df.iterrows():
                db.add(Vendor(
                    name=row["vendor_name"],
                    gstin=row.get("gstin"),
                    category=row.get("category"),
                    is_in_master_list=1,
                    vendor_risk_score=0.0,
                ))
            db.commit()
            print(f"\n[3/5] Seeded {len(vm_df)} vendors.")
        else:
            print("\n[3/5] vendor_master.csv not found, skipping vendor seeding.")

        # Step 4: Seed Ledger Entries
        l_path = os.path.join(OUTPUT_DIR, "ledger.csv")
        if os.path.exists(l_path):
            l_df = pd.read_csv(l_path)
            for _, row in l_df.iterrows():
                posting_dt = None
                if row.get("posting_date"):
                    try:
                        posting_dt = dt.datetime.strptime(str(row["posting_date"]), "%Y-%m-%d")
                    except ValueError:
                        pass
                db.add(LedgerEntry(
                    invoice_number=row["invoice_number"],
                    vendor_name=row["vendor_name"],
                    total_amount=float(row["total_amount"]),
                    posting_date=posting_dt,
                ))
            db.commit()
            print(f"[3/5] Seeded {len(l_df)} ledger entries.")

        # Step 5: Process all invoice PDFs through the real pipeline
        pdf_files = sorted([f for f in os.listdir(INVOICES_DIR) if f.endswith(".pdf")])
        print(f"\n[4/5] Processing {len(pdf_files)} invoice PDFs through live pipeline...")
        print("      (Gemini AI calls are bounded to 30s each; pipeline continues on timeout)")

        file_payloads = []
        file_bytes_map = {}
        for f_name in pdf_files:
            f_path = os.path.join(INVOICES_DIR, f_name)
            with open(f_path, "rb") as f:
                data = f.read()
                file_payloads.append((f_name, data))
                file_bytes_map[f_name] = data

        batch_result = process_batch(file_payloads)

        processed_count = 0
        failed_count = 0
        for item in batch_result.get("processed", []):
            f_name = item["filename"]
            try:
                process_invoice(
                    db,
                    filename=f_name,
                    extraction=item["extraction"],
                    forensics=item["forensics"],
                    file_bytes=file_bytes_map.get(f_name),
                )
                processed_count += 1
                if processed_count % 10 == 0:
                    print(f"      ... {processed_count}/{len(pdf_files)} processed")
            except Exception as exc:
                logger.error("Failed to process %s: %s", f_name, exc)
                failed_count += 1

        for item in batch_result.get("rejected", []):
            logger.warning("Rejected during ingestion: %s", item.get("filename"))
            failed_count += 1

        db.commit()

        # Step 6: Print final summary
        invoice_count = db.query(Invoice).count()
        ticket_count = db.query(Ticket).count()
        from sqlalchemy import func
        risk_dist = dict(db.query(Invoice.risk_level, func.count(Invoice.id)).group_by(Invoice.risk_level).all())

        print(f"\n[5/5] Seed complete!")
        print(f"      Invoices: {invoice_count}  |  Exception Tickets: {ticket_count}")
        print(f"      Risk distribution: {risk_dist}")
        print(f"      Failed: {failed_count}")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    seed()
