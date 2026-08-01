"""Regex/rule-based structured field parsing on top of raw OCR text."""
import re

PATTERNS = {
    "invoice_number": r"(?:invoice\s*(?:no|number|#)|ref\s*#)[:\s]*([A-Za-z0-9\-/]+)",
    "vendor_gstin": r"\b(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1})\b",
    "invoice_date": r"(?:date|dt\.?)[:\s]*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
    "total_amount": r"(?:grand\s*)?total\s*(?:amount)?[:\s]*(?:Rs\.?|INR)?\s*([\d,]+\.?\d*)",
    "taxable_value": r"(?:taxable\s*(?:value|amount)?[:\s]*)(?:Rs\.?|INR)?\s*([\d,]+\.?\d*)",
}

def parse_fields(text: str) -> dict:
    out = {}
    for field, pat in PATTERNS.items():
        m = re.search(pat, text, re.IGNORECASE)
        out[field] = m.group(1).strip() if m else None

    for tax in ("cgst", "sgst", "igst"):
        m = re.search(rf"{tax}\s*(?:@\s*\d+%|\d+%)?[:\s]*(?:Rs\.?|INR)?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
        out[tax] = m.group(1).replace(",", "") if m else None

    for amt_field in ("total_amount", "taxable_value"):
        if out[amt_field]:
            out[amt_field] = out[amt_field].replace(",", "")

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    out["vendor_name"] = lines[0] if lines else None

    return out