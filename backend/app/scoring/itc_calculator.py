"""
Sums tax_amount across critically-flagged invoices -> Input Tax Credit at risk (₹).

Pipeline stage: Stage 5 - Scoring
Status: stub — not yet implemented.
"""


def not_implemented():
    raise NotImplementedError("backend/app/scoring/itc_calculator.py is a scaffold stub. Implement this module.")

"""
Sums tax_amount across critically-flagged invoices -> Input Tax Credit at risk (₹).

Pipeline stage: Stage 5 - Scoring
"""


def calculate_itc_at_risk(scored_invoices: list[dict]) -> dict:
    """Takes a list of invoices, each expected to have 'risk_level' (from risk_scorer)
    and tax fields (cgst, sgst, igst). Sums tax across every 'high' risk invoice.
    Returns {'itc_at_risk': float, 'invoice_count': int, 'invoice_numbers': list}."""
    total = 0.0
    flagged_numbers = []

    for inv in scored_invoices:
        if inv.get("risk_level") != "high":
            continue
        tax = float(inv.get("cgst", 0) or 0) + float(inv.get("sgst", 0) or 0) + float(inv.get("igst", 0) or 0)
        total += tax
        flagged_numbers.append(inv.get("invoice_number"))

    return {
        "itc_at_risk": round(total, 2),
        "invoice_count": len(flagged_numbers),
        "invoice_numbers": flagged_numbers,
    }