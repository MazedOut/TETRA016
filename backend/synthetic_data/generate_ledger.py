"""Generates the matching purchase ledger CSV, including intentional gaps/mismatches
so reconciliation logic (ledger_matcher, mismatch_checks, sequence_gap) has real
cases to detect."""
import pandas as pd
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from synthetic_data.generate_invoices import DEMO_INVOICES

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
TODAY = datetime(2026, 8, 1)

# Invoices deliberately excluded from ledger (triggers missing_ledger_entry check)
MISSING_FROM_LEDGER = {"INV-901", "INV-1302"}

# Planted amount / date mismatches vs true invoice values
PLANTED_MISMATCHES = {
    "INV-701": {"posted_amount": 28500.00, "date_offset_days": 2}, # Invoice amount 21240 vs 28500 posted
    "INV-801": {"posted_amount": 14160.00, "date_offset_days": 24}, # Invoice date 01-07-2026, posted 25-07-2026 (24 days delta > 7)
}


def generate_ledger():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    rows = []
    for inv in DEMO_INVOICES:
        inv_num = inv["invoice_number"]
        if inv_num in MISSING_FROM_LEDGER:
            continue

        posted_amount = inv["total_amount"]
        # Parse invoice date
        try:
            d_parts = inv["invoice_date"].split("-")
            inv_date = datetime(int(d_parts[2]), int(d_parts[1]), int(d_parts[0]))
        except Exception:
            inv_date = TODAY - timedelta(days=5)

        posting_date = inv_date + timedelta(days=2) # standard posting

        if inv_num in PLANTED_MISMATCHES:
            m = PLANTED_MISMATCHES[inv_num]
            posted_amount = m["posted_amount"]
            posting_date = inv_date + timedelta(days=m["date_offset_days"])

        rows.append({
            "invoice_number": inv_num,
            "vendor_name": inv["vendor_name"],
            "total_amount": round(posted_amount, 2),
            "posting_date": posting_date.strftime("%Y-%m-%d"),
        })

    df = pd.DataFrame(rows)
    out_path = os.path.join(OUTPUT_DIR, "ledger.csv")
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} ledger rows -> {out_path}")
    return df


if __name__ == "__main__":
    generate_ledger()