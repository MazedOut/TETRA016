"""Per-field extraction confidence scoring (0-100%)."""
from app.config import CRITICAL_FIELDS, CONFIDENCE_LOW_THRESHOLD

def score_fields(fields: dict, avg_conf: float) -> dict:
    """Returns {field: confidence_0_to_1}. Missing critical fields get heavily penalized."""
    scores = {}
    base = avg_conf / 100
    for field, val in fields.items():
        if val is None:
            scores[field] = 0.0
        elif field in CRITICAL_FIELDS:
            scores[field] = base
        else:
            scores[field] = min(base + 0.1, 1.0)
    return scores

def needs_fallback(scores: dict) -> list[str]:
    """Returns list of field names below the low-confidence threshold, critical fields only."""
    return [f for f in CRITICAL_FIELDS if scores.get(f, 0) < CONFIDENCE_LOW_THRESHOLD]