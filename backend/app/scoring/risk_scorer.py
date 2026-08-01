"""
Weighted aggregation of all rule failures into a 0-100 risk score with Low/Medium/High classification.

Pipeline stage: Stage 5 - Scoring
Status: stub — not yet implemented.
"""


def not_implemented():
    raise NotImplementedError("backend/app/scoring/risk_scorer.py is a scaffold stub. Implement this module.")

"""
Weighted aggregation of all rule failures into a 0-100 risk score with Low/Medium/High classification.

Pipeline stage: Stage 5 - Scoring
"""
from app.config import RISK_WEIGHTS, RISK_THRESHOLDS


def score_invoice(flags: list[dict]) -> dict:
    """Takes a list of flag dicts (each with a 'check' key) already generated for
    ONE invoice by the various reconciliation modules, and aggregates them into
    a single 0-100 risk score plus explainable breakdown.

    This function does not run any checks itself — it only aggregates flags
    that were already produced elsewhere in the pipeline.
    """
    if not flags:
        return {
            "risk_score": 0,
            "risk_level": "low",
            "contributing_checks": [],
        }

    seen_checks = set()
    breakdown = []
    total = 0

    for flag in flags:
        check_name = flag.get("check")
        if check_name is None or check_name in seen_checks:
            continue  # each check type only counts once per invoice, even if flagged twice
        weight = RISK_WEIGHTS.get(check_name, 0)
        if weight == 0:
            continue  # unknown check name, ignore silently rather than crash
        seen_checks.add(check_name)
        total += weight
        breakdown.append({
            "check": check_name,
            "points": weight,
            "reason": flag.get("reason", ""),
        })

    risk_score = min(total, 100)

    if risk_score >= RISK_THRESHOLDS["high"]:
        risk_level = "high"
    elif risk_score >= RISK_THRESHOLDS["medium"]:
        risk_level = "medium"
    else:
        risk_level = "low"

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "contributing_checks": breakdown,
    }