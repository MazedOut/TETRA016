"""Generates the vendor master CSV, including at least one vendor deliberately left out
(to trigger phantom-vendor detection) and one near-duplicate vendor name (to trigger
typo-squatting detection)."""
import pandas as pd
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.reconciliation.gstin_validator import _compute_checksum_char

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# (state_code+PAN+entity+"Z" — 14 chars, checksum computed automatically)
VENDOR_BASES = [
    {"vendor_name": "Sharma Traders",       "gstin_base": "24AAACS1234F1Z", "category": "raw_materials"},
    {"vendor_name": "Bansal Electricals",   "gstin_base": "27AACCB5678K1Z", "category": "electronics"},
    {"vendor_name": "Patel Logistics",      "gstin_base": "24AABCP4321L1Z", "category": "logistics"},
    {"vendor_name": "Iyer & Sons",          "gstin_base": "33AADFI9988M1Z", "category": "office_supplies"},
    {"vendor_name": "Nair Textiles",        "gstin_base": "32AABCN2233N1Z", "category": "textiles"},
    {"vendor_name": "Gupta Packaging",      "gstin_base": "07AAACG3344P1Z", "category": "packaging"},
    {"vendor_name": "Reddy Chemicals",      "gstin_base": "36AABCR5566Q1Z", "category": "chemicals"},
    {"vendor_name": "Verma Hardware",       "gstin_base": "09AABCV7788R1Z", "category": "hardware"},
    {"vendor_name": "Kapoor Consultants",   "gstin_base": "06AABCK8899S1Z", "category": "services"},
    {"vendor_name": "Joshi Fabrication",    "gstin_base": "24AABCJ1122T1Z", "category": "fabrication"},
    {"vendor_name": "Menon Furniture",      "gstin_base": "32AABCM3344U1Z", "category": "furniture"},
    {"vendor_name": "Rao Printers",         "gstin_base": "29AABCR6677V1Z", "category": "printing"},
]


def generate_vendor_master():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    rows = []
    for v in VENDOR_BASES:
        checksum = _compute_checksum_char(v["gstin_base"])
        rows.append({
            "vendor_name": v["vendor_name"],
            "gstin": v["gstin_base"] + checksum,
            "category": v["category"],
        })

    df = pd.DataFrame(rows)
    out_path = os.path.join(OUTPUT_DIR, "vendor_master.csv")
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} vendors -> {out_path}")
    return df


if __name__ == "__main__":
    generate_vendor_master()