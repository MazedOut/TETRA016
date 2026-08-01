"""
Benford's Law first-digit distribution check per vendor.

Pipeline stage: Stage 4 - Reconciliation
"""

import pandas as pd
from collections import Counter
import math

MIN_INVOICES_FOR_BENFORD = 10
CHI_SQUARE_THRESHOLD = 15.51  # p=0.05 critical value for 8 degrees of freedom (digits 1-9)

# Expected Benford's Law proportions for leading digits 1-9
BENFORD_EXPECTED = {d: math.log10(1 + 1 / d) for d in range(1, 10)}


def _leading_digit(amount: float) -> int | None:
    s = str(abs(amount)).lstrip("0.")
    for ch in s:
        if ch.isdigit() and ch != "0":
            return int(ch)
    return None


def check_benford(invoices: list[dict]) -> list[dict]:
    """Groups by vendor, computes leading-digit distribution, flags vendors whose
    distribution deviates significantly from Benford's expected curve (chi-square test)."""
    flags = []
    df = pd.DataFrame(invoices)
    if df.empty or "vendor_name" not in df.columns:
        return flags

    for vendor, group in df.groupby("vendor_name"):
        if len(group) < MIN_INVOICES_FOR_BENFORD:
            continue

        digits = [d for d in (_leading_digit(a) for a in group["total_amount"]) if d is not None]
        n = len(digits)
        if n < MIN_INVOICES_FOR_BENFORD:
            continue

        observed_counts = Counter(digits)
        chi_square = 0.0
        for d in range(1, 10):
            observed = observed_counts.get(d, 0)
            expected = BENFORD_EXPECTED[d] * n
            if expected > 0:
                chi_square += (observed - expected) ** 2 / expected

        if chi_square > CHI_SQUARE_THRESHOLD:
            flags.append({
                "check": "benford_deviation",
                "vendor_name": vendor,
                "reason": f"Vendor '{vendor}' invoice amounts deviate significantly from "
                          f"Benford's Law expected first-digit distribution "
                          f"(chi-square={chi_square:.1f}, threshold={CHI_SQUARE_THRESHOLD}) "
                          f"across {n} invoices — possible fabricated numbers.",
            })
    return flags