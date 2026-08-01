"""
Vendor-level frequency/amount anomaly (z-score/IQR) and off-hours/weekend timestamp detection.

Pipeline stage: Stage 4 - Reconciliation
"""

import pandas as pd

MIN_INVOICES_FOR_ANOMALY_CHECK = 5  # need enough history to compute a meaningful z-score
Z_SCORE_THRESHOLD = 1.5             # flag if more than 2 std deviations from the vendor's own mean
OFF_HOURS_START = 22                # 10 PM
OFF_HOURS_END = 6                   # 6 AM


def detect_amount_anomalies(invoices: list[dict]) -> list[dict]:
    """Groups invoices by vendor, computes each vendor's own mean/std of total_amount,
    and flags any invoice more than Z_SCORE_THRESHOLD std deviations away."""
    flags = []
    df = pd.DataFrame(invoices)
    if df.empty or "vendor_name" not in df.columns or "total_amount" not in df.columns:
        return flags

    for vendor, group in df.groupby("vendor_name"):
        if len(group) < MIN_INVOICES_FOR_ANOMALY_CHECK:
            continue  # not enough history for this vendor yet

        mean = group["total_amount"].mean()
        std = group["total_amount"].std()
        if std == 0 or pd.isna(std):
            continue  # no variation at all, nothing meaningful to compute

        for _, row in group.iterrows():
            z = (row["total_amount"] - mean) / std
            if abs(z) > Z_SCORE_THRESHOLD:
                flags.append({
                    "check": "vendor_activity_anomaly",
                    "invoice_number": row.get("invoice_number"),
                    "reason": f"Invoice amount ₹{row['total_amount']:.2f} from '{vendor}' is "
                              f"{abs(z):.1f} standard deviations from this vendor's usual "
                              f"average of ₹{mean:.2f} — unusual for this vendor's own pattern.",
                })
    return flags


def detect_off_hours_invoices(invoices: list[dict]) -> list[dict]:
    """Flags invoices timestamped late night/early morning or on a weekend."""
    flags = []
    for inv in invoices:
        ts = inv.get("invoice_date")
        if ts is None:
            continue

        is_off_hours = ts.hour >= OFF_HOURS_START or ts.hour < OFF_HOURS_END
        is_weekend = ts.weekday() >= 5  # 5=Saturday, 6=Sunday

        if is_off_hours or is_weekend:
            reasons = []
            if is_off_hours:
                reasons.append(f"timestamped {ts.strftime('%H:%M')} (off-hours)")
            if is_weekend:
                reasons.append(f"falls on a {ts.strftime('%A')} (weekend)")
            flags.append({
                "check": "vendor_activity_anomaly",
                "invoice_number": inv.get("invoice_number"),
                "reason": f"Invoice from '{inv.get('vendor_name')}' is {' and '.join(reasons)} — "
                          f"unusual timing for typical B2B invoicing.",
            })
    return flags