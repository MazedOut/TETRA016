"""
Section 43B(h) 45-day MSME payment rule: estimates disallowed expense and tax penalty.

Pipeline stage: Stage 5 - Scoring
"""

from datetime import datetime
from app.config import MSME_PAYMENT_DEADLINE_DAYS, MSME_DISALLOWED_TAX_RATE


def check_msme_penalty(invoice: dict, is_paid: bool, payment_date=None, today: datetime = None) -> dict:
    """Checks if this invoice is unpaid past the 45-day deadline.
    'today' is injectable for testing; defaults to now.
    Returns {'flagged': bool, 'disallowed_amount': float, 'penalty_amount': float, 'reason': str or None}."""
    today = today or datetime.now()
    invoice_date = invoice.get("invoice_date")
    total_amount = float(invoice.get("total_amount", 0) or 0)

    if invoice_date is None:
        return {"flagged": False, "disallowed_amount": 0, "penalty_amount": 0, "reason": None}

    reference_date = payment_date if (is_paid and payment_date) else today
    days_elapsed = (reference_date - invoice_date).days

    if is_paid and payment_date and days_elapsed <= MSME_PAYMENT_DEADLINE_DAYS:
        return {"flagged": False, "disallowed_amount": 0, "penalty_amount": 0, "reason": None}

    if not is_paid and days_elapsed <= MSME_PAYMENT_DEADLINE_DAYS:
        return {"flagged": False, "disallowed_amount": 0, "penalty_amount": 0, "reason": None}

    penalty = round(total_amount * MSME_DISALLOWED_TAX_RATE, 2)
    return {
        "flagged": True,
        "disallowed_amount": total_amount,
        "penalty_amount": penalty,
        "reason": f"Invoice unpaid {days_elapsed} days (> {MSME_PAYMENT_DEADLINE_DAYS}-day MSME limit). "
                  f"Estimated disallowed expense ₹{total_amount:.2f}, penalty ₹{penalty:.2f} "
                  f"at {MSME_DISALLOWED_TAX_RATE*100:.0f}% rate.",
    }


def calculate_batch_penalties(invoices: list[dict], today: datetime = None) -> dict:
    """Runs the check across a batch. Each invoice dict should have 'is_paid' and
    optionally 'payment_date'. Returns aggregate totals plus per-invoice detail."""
    today = today or datetime.now()
    flagged = []
    total_penalty = 0.0

    for inv in invoices:
        result = check_msme_penalty(
            inv,
            is_paid=inv.get("is_paid", False),
            payment_date=inv.get("payment_date"),
            today=today,
        )
        if result["flagged"]:
            total_penalty += result["penalty_amount"]
            flagged.append({"invoice_number": inv.get("invoice_number"), **result})

    return {
        "total_estimated_penalty": round(total_penalty, 2),
        "flagged_invoices": flagged,
    }