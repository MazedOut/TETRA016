"""Loads the synthetic dataset (backend/synthetic_data/output/) into the database for demo/testing."""
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pandas as pd
import datetime as dt
from app.db.database import SessionLocal, Base, engine
from app.models.invoice import Invoice
from app.models.ticket import Ticket
from app.models.vendor import Vendor
from app.models.ledger_entry import LedgerEntry
from app.ingestion.batch_handler import process_batch
from app.orchestrator import process_invoice

from synthetic_data.generate_vendor_master import generate_vendor_master
from synthetic_data.generate_ledger import generate_ledger
from synthetic_data.generate_invoices import generate_invoices, INVOICES_DIR, OUTPUT_DIR


def seed():
    print("Generating synthetic datasets (vendor master, ledger, invoices)...")
    generate_vendor_master()
    generate_ledger()
    generate_invoices()

    print("Initializing database tables...")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    db = SessionLocal()


    try:
        # 1. Clear existing database rows
        db.query(Ticket).delete()
        db.query(Invoice).delete()
        db.query(Vendor).delete()
        db.query(LedgerEntry).delete()
        db.commit()

        # 2. Seed Vendor Master
        vm_path = os.path.join(OUTPUT_DIR, "vendor_master.csv")
        if os.path.exists(vm_path):
            vm_df = pd.read_csv(vm_path)
            for _, row in vm_df.iterrows():
                db.add(Vendor(
                    name=row["vendor_name"],
                    gstin=row["gstin"],
                    category=row.get("category"),
                    is_in_master_list=1,
                    vendor_risk_score=0.0,
                ))
            db.commit()
            print(f"Seeded {len(vm_df)} vendors into DB.")

        # 3. Seed Ledger Entries
        l_path = os.path.join(OUTPUT_DIR, "ledger.csv")
        if os.path.exists(l_path):
            l_df = pd.read_csv(l_path)
            for _, row in l_df.iterrows():
                posting_dt = dt.datetime.strptime(row["posting_date"], "%Y-%m-%d") if row.get("posting_date") else None
                db.add(LedgerEntry(
                    invoice_number=row["invoice_number"],
                    vendor_name=row["vendor_name"],
                    total_amount=float(row["total_amount"]),
                    posting_date=posting_dt,
                ))
            db.commit()
            print(f"Seeded {len(l_df)} ledger entries into DB.")

        # 4. Process all invoice PDFs through real ingestion + extraction + orchestrator pipeline
        pdf_files = [f for f in os.listdir(INVOICES_DIR) if f.endswith(".pdf")]
        print(f"Processing {len(pdf_files)} PDF invoices through live pipeline...")

        file_payloads = []
        for f_name in pdf_files:
            f_path = os.path.join(INVOICES_DIR, f_name)
            with open(f_path, "rb") as f:
                file_payloads.append((f_name, f.read()))

        payload_dict = {f_name: b for f_name, b in file_payloads}
        batch_result = process_batch(file_payloads)
        processed_count = 0
        for item in batch_result["processed"]:
            f_name = item["filename"]
            process_invoice(
                db,
                filename=f_name,
                extraction=item["extraction"],
                forensics=item["forensics"],
                file_bytes=payload_dict.get(f_name),
            )
            processed_count += 1


        db.commit()
        ticket_count = db.query(Ticket).count()
        print(f"Successfully processed {processed_count} invoices into DB. Created {ticket_count} exception tickets.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
