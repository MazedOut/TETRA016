"""
Per-vendor invoice-numbering profile; flags missing sequential invoice numbers.

Pipeline stage: Stage 4 - Reconciliation
"""

import re
import pandas as pd

# Matches invoice numbers like "INV-101" -> prefix "INV-", number 101
SEQUENCE_PATTERN = re.compile(r"^(.*?)(\d+)$")

MIN_INVOICES_FOR_SEQUENCE_CHECK = 2  # need at least this many to infer a sequential pattern


def _parse_invoice_number(inv_num: str):
    """Splits an invoice number into (prefix, numeric_part) if it matches the pattern,
    else returns (None, None)."""
    match = SEQUENCE_PATTERN.match(str(inv_num).strip())
    if not match:
        return None, None
    prefix, number_str = match.groups()
    return prefix, int(number_str)


def detect_sequence_gaps(invoices: list[dict]) -> list[dict]:
    """Groups invoices by vendor, checks each vendor's invoice numbers for a
    consistent prefix + numeric sequence, and flags any gaps found.
    Returns a list of flag dicts."""
    flags = []

    df = pd.DataFrame(invoices)
    if df.empty or "vendor_name" not in df.columns:
        return flags

    for vendor, group in df.groupby("vendor_name"):
        parsed = []
        for _, row in group.iterrows():
            prefix, number = _parse_invoice_number(row["invoice_number"])
            if prefix is not None:
                parsed.append({"invoice_number": row["invoice_number"], "prefix": prefix, "number": number})

        if len(parsed) < MIN_INVOICES_FOR_SEQUENCE_CHECK:
            continue  # not enough data to infer a sequence pattern for this vendor

        # Only proceed if all invoices share the same prefix (a real sequential scheme)
        prefixes = {p["prefix"] for p in parsed}
        if len(prefixes) != 1:
            continue  # mixed prefixes -> not a clean sequential numbering scheme, skip

        numbers = sorted(p["number"] for p in parsed)
        prefix = parsed[0]["prefix"]

        expected_full_range = set(range(numbers[0], numbers[-1] + 1))
        actual_numbers = set(numbers)
        missing = sorted(expected_full_range - actual_numbers)

        for missing_num in missing:
            flags.append({
                "check": "sequence_gap",
                "vendor_name": vendor,
                "reason": f"Vendor '{vendor}' has invoices numbered {prefix}{numbers[0]} through "
                          f"{prefix}{numbers[-1]}, but {prefix}{missing_num} is missing from the sequence.",
            })

    return flags