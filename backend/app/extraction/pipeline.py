"""Orchestrates: ocr_engine -> field_parser -> confidence_scorer -> gemini_fallback -> math_check."""
from app.config import CRITICAL_FIELDS
from .ocr_engine import run_ocr
from .field_parser import parse_fields
from .confidence_scorer import score_fields, needs_fallback
from .gemini_fallback import fix_fields
from .math_check import check

def extract_invoice(filename: str, data: bytes) -> dict:
    ocr_result = run_ocr(filename, data)
    fields = parse_fields(ocr_result["text"])
    scores = score_fields(fields, ocr_result["avg_conf"])
    missing = needs_fallback(scores)

    used_gemini = False
    if missing:
        ext = filename.rsplit(".", 1)[-1].lower()
        mime = "application/pdf" if ext == "pdf" else f"image/{ext}"
        fixed = fix_fields(data, mime, missing)
        for k, v in fixed.items():
            if v is not None:
                fields[k] = v
        used_gemini = True

    math_ok, math_reason = check(fields)

    # only critical fields (invoice_number, vendor_name, total_amount) still null after OCR + Gemini fallback = needs human attention
    needs_review = [f for f in CRITICAL_FIELDS if fields.get(f) is None]

    return {
        "fields": fields,
        "field_confidence": scores,
        "avg_conf": ocr_result["avg_conf"],
        "ocr_source": "gemini" if used_gemini else ocr_result["source"],
        "math_ok": math_ok,
        "math_reason": math_reason,
        "needs_review": needs_review,
        "flagged_for_review": len(needs_review) > 0,
    }