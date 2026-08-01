"""Internal math integrity check: taxable_value + tax_amount == total_amount."""

def _num(v):
    if v is None:
        return 0.0
    return float(str(v).replace(",", "").replace("Rs.", "").strip())

def check(fields: dict) -> tuple[bool, str]:
    try:
        taxable = _num(fields.get("taxable_value"))
        total = _num(fields.get("total_amount"))
        tax = sum(_num(fields.get(t)) for t in ("cgst", "sgst", "igst"))
        if abs((taxable + tax) - total) < 0.5:
            return True, ""
        return False, f"mismatch: {taxable}+{tax} != {total}"
    except (TypeError, ValueError) as e:
        return False, f"non-numeric fields, cannot verify: {e}"