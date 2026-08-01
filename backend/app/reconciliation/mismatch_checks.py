"""
Amount mismatch and date mismatch checks against ledger, with configurable thresholds.

Pipeline stage: Stage 4 - Reconciliation
Status: stub — not yet implemented.
"""


def not_implemented():
    raise NotImplementedError("backend/app/reconciliation/mismatch_checks.py is a scaffold stub. Implement this module.")

"""
Amount mismatch and date mismatch checks against ledger, with configurable thresholds.

Pipeline stage: Stage 4 - Reconciliation
"""
AMOUNT_MISMATCH_TOLERANCE = 0.01   # 1% — differences above this are flagged
DATE_MISMATCH_THRESHOLD_DAYS = 7   # posting more than this many days off invoice date is flagged


def check_amount_mismatch(invoice: dict, ledger_row: dict) -> dict:
    """Returns a flag dict if amounts differ beyond tolerance, else {'flagged': False}."""
    inv_amount = float(invoice.get("total_amount", 0))
    ledger_amount = float(ledger_row.get("total_amount", 0))

    if inv_amount == 0:
        return {"flagged": False}

    diff_pct = abs(inv_amount - ledger_amount) / inv_amount
    if diff_pct > AMOUNT_MISMATCH_TOLERANCE:
        return {
            "flagged": True,
            "check": "amount_mismatch",
            "reason": f"Invoice amount ₹{inv_amount:.2f} does not match ledger-posted amount "
                      f"₹{ledger_amount:.2f} (difference: {diff_pct*100:.1f}%).",
        }
    return {"flagged": False}


def check_date_mismatch(invoice: dict, ledger_row: dict) -> dict:
    """Returns a flag dict if posting date is too far from invoice date, else {'flagged': False}."""
    inv_date = invoice.get("invoice_date")
    posted_date = ledger_row.get("posting_date")

    if inv_date is None or posted_date is None:
        return {"flagged": False}

    delta_days = abs((posted_date - inv_date).days)
    if delta_days > DATE_MISMATCH_THRESHOLD_DAYS:
        return {
            "flagged": True,
            "check": "date_mismatch",
            "reason": f"Invoice dated {inv_date.date()} but posted to ledger on "
                      f"{posted_date.date()} — {delta_days} days apart, beyond the "
                      f"{DATE_MISMATCH_THRESHOLD_DAYS}-day threshold.",
        }
    return {"flagged": False}


def check_mismatches(invoice: dict, ledger_row: dict) -> list[dict]:
    """Runs both checks, returns list of flags (empty if clean)."""
    flags = []
    amount_result = check_amount_mismatch(invoice, ledger_row)
    if amount_result["flagged"]:
        flags.append(amount_result)
    date_result = check_date_mismatch(invoice, ledger_row)
    if date_result["flagged"]:
        flags.append(date_result)
    return flags