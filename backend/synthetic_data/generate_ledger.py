"""Generates the matching purchase ledger CSV, including intentional gaps/mismatches
so reconciliation logic (ledger_matcher, mismatch_checks, sequence_gap) has real
cases to detect."""
import pandas as pd
import os
from datetime import datetime, timedelta

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
TODAY = datetime(2026, 8, 1)  # fixed "today" so re-running gives stable demo data

# Master invoice list — the shared reference for this synthetic dataset.
# Each row: invoice_number, vendor_name, invoice_date, total_amount
INVOICES = [
    # Sharma Traders — deliberate sequence gap: 101, 102, [103 missing], 104
    {"invoice_number": "INV-101", "vendor_name": "Sharma Traders", "invoice_date": TODAY - timedelta(days=10), "total_amount": 11800.00},
    {"invoice_number": "INV-102", "vendor_name": "Sharma Traders", "invoice_date": TODAY - timedelta(days=8),  "total_amount": 23600.00},
    {"invoice_number": "INV-104", "vendor_name": "Sharma Traders", "invoice_date": TODAY - timedelta(days=3),  "total_amount": 9440.00},

    {"invoice_number": "INV-201", "vendor_name": "Bansal Electricals", "invoice_date": TODAY - timedelta(days=15), "total_amount": 47200.00},
    {"invoice_number": "INV-202", "vendor_name": "Bansal Electricals", "invoice_date": TODAY - timedelta(days=50), "total_amount": 15340.00},  # -> MSME overdue test

    {"invoice_number": "INV-301", "vendor_name": "Patel Logistics", "invoice_date": TODAY - timedelta(days=5),  "total_amount": 8260.00},
    {"invoice_number": "INV-302", "vendor_name": "Patel Logistics", "invoice_date": TODAY - timedelta(days=60), "total_amount": 12980.00},  # -> MSME overdue test

    {"invoice_number": "INV-401", "vendor_name": "Iyer & Sons",       "invoice_date": TODAY - timedelta(days=7),  "total_amount": 5900.00},
    {"invoice_number": "INV-501", "vendor_name": "Nair Textiles",     "invoice_date": TODAY - timedelta(days=6),  "total_amount": 33040.00},
    {"invoice_number": "INV-601", "vendor_name": "Gupta Packaging",   "invoice_date": TODAY - timedelta(days=4),  "total_amount": 7080.00},
    {"invoice_number": "INV-701", "vendor_name": "Reddy Chemicals",   "invoice_date": TODAY - timedelta(days=2),  "total_amount": 21240.00},
    {"invoice_number": "INV-801", "vendor_name": "Verma Hardware",    "invoice_date": TODAY - timedelta(days=9),  "total_amount": 14160.00},
    {"invoice_number": "INV-901", "vendor_name": "Kapoor Consultants","invoice_date": TODAY - timedelta(days=1),  "total_amount": 29500.00},
    {"invoice_number": "INV-1001","vendor_name": "Joshi Fabrication", "invoice_date": TODAY - timedelta(days=11), "total_amount": 18880.00},
    {"invoice_number": "INV-1101","vendor_name": "Menon Furniture",   "invoice_date": TODAY - timedelta(days=12), "total_amount": 41300.00},
    {"invoice_number": "INV-1201","vendor_name": "Rao Printers",      "invoice_date": TODAY - timedelta(days=14), "total_amount": 6490.00},

    # Two invoices deliberately excluded from the ledger below (missing_ledger_entry test)
    {"invoice_number": "INV-1301", "vendor_name": "Nair Textiles",   "invoice_date": TODAY - timedelta(days=13), "total_amount": 9990.00},
    {"invoice_number": "INV-1302", "vendor_name": "Gupta Packaging", "invoice_date": TODAY - timedelta(days=16), "total_amount": 13500.00},

    # Two amount-mismatch cases and one date-mismatch case (built into the ledger loop below)
    {"invoice_number": "INV-1401", "vendor_name": "Reddy Chemicals", "invoice_date": TODAY - timedelta(days=17), "total_amount": 22000.00},
    {"invoice_number": "INV-1402", "vendor_name": "Verma Hardware",  "invoice_date": TODAY - timedelta(days=18), "total_amount": 16000.00},
    {"invoice_number": "INV-1403", "vendor_name": "Kapoor Consultants","invoice_date": TODAY - timedelta(days=19),"total_amount": 27750.00},
]

# Invoice numbers to deliberately OMIT from the ledger entirely
MISSING_FROM_LEDGER = {"INV-1301", "INV-1302"}

# invoice_number -> (posted_amount, posted_date_offset_days_from_invoice_date)
# Used to plant amount/date mismatches vs the invoice's true values above.
PLANTED_MISMATCHES = {
    "INV-1401": {"amount_delta": 500.00,  "date_delta_days": 0},   # amount mismatch: posted 22500 vs invoice 22000
    "INV-1402": {"amount_delta": -1200.00, "date_delta_days": 0},  # amount mismatch: posted 14800 vs invoice 16000
    "INV-1403": {"amount_delta": 0.0,      "date_delta_days": 12}, # date mismatch: posted 12 days after invoice date
}


def generate_ledger():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    rows = []
    for inv in INVOICES:
        if inv["invoice_number"] in MISSING_FROM_LEDGER:
            continue  # deliberately absent from ledger

        posted_amount = inv["total_amount"]
        posted_date = inv["invoice_date"] + timedelta(days=2)  # normal: posted ~2 days after invoicing

        if inv["invoice_number"] in PLANTED_MISMATCHES:
            m = PLANTED_MISMATCHES[inv["invoice_number"]]
            posted_amount += m["amount_delta"]
            posted_date += timedelta(days=m["date_delta_days"])

        rows.append({
            "invoice_number": inv["invoice_number"],
            "vendor_name": inv["vendor_name"],
            "total_amount": round(posted_amount, 2),
            "posting_date": posted_date.strftime("%Y-%m-%d"),
        })

    df = pd.DataFrame(rows)
    out_path = os.path.join(OUTPUT_DIR, "ledger.csv")
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} ledger rows -> {out_path}")
    print(f"Deliberately missing from ledger: {sorted(MISSING_FROM_LEDGER)}")
    print(f"Planted mismatches: {list(PLANTED_MISMATCHES.keys())}")
    return df


if __name__ == "__main__":
    generate_ledger()