"""
GSTIN regex + checksum validation; inter/intra-state CGST+SGST vs IGST check.

Pipeline stage: Stage 4 - Reconciliation
Status: stub — not yet implemented.
"""

"""
GSTIN regex + checksum validation; inter/intra-state CGST+SGST vs IGST check.

Pipeline stage: Stage 4 - Reconciliation
"""
import re
from app.config import BUYER_GSTIN

GSTIN_REGEX = re.compile(r"^(\d{2})[A-Z]{5}\d{4}[A-Z]\dZ[A-Z0-9]$")

# Checksum alphabet used by the official GSTIN mod-36 checksum algorithm
_CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _compute_checksum_char(gstin_without_checksum: str) -> str:
    """Computes the official GSTIN checksum character (mod-36 algorithm)
    over the first 14 characters."""
    factor = 2
    total = 0
    for ch in reversed(gstin_without_checksum):
        code = _CHECKSUM_CHARS.index(ch)
        digit = factor * code
        digit = (digit // 36) + (digit % 36)
        total += digit
        factor = 1 if factor == 2 else 2
    remainder = total % 36
    check_code = (36 - remainder) % 36
    return _CHECKSUM_CHARS[check_code]


def validate_gstin_structure(gstin: str) -> dict:
    """Returns {'valid': bool, 'reason': str or None} for a single GSTIN."""
    if not gstin or not isinstance(gstin, str):
        return {"valid": False, "reason": "GSTIN missing or not a string."}

    gstin = gstin.strip().upper()

    if not GSTIN_REGEX.match(gstin):
        return {"valid": False, "reason": f"GSTIN '{gstin}' does not match the expected 15-character format."}

    expected_checksum = _compute_checksum_char(gstin[:14])
    actual_checksum = gstin[14]
    if expected_checksum != actual_checksum:
        return {"valid": False, "reason": f"GSTIN '{gstin}' fails checksum validation "
                                           f"(expected '{expected_checksum}', got '{actual_checksum}')."}

    return {"valid": True, "reason": None}


def check_tax_type(vendor_gstin: str, cgst: float, sgst: float, igst: float, buyer_gstin: str = BUYER_GSTIN) -> dict:
    """Compares vendor/buyer state codes to verify CGST+SGST vs IGST was applied correctly.
    Returns {'flagged': bool, 'reason': str or None}."""
    if not vendor_gstin or len(vendor_gstin) < 2:
        return {"flagged": False, "reason": "Vendor GSTIN unavailable, skipping tax-type check."}

    vendor_state = vendor_gstin[:2]
    buyer_state = buyer_gstin[:2]

    cgst = cgst or 0
    sgst = sgst or 0
    igst = igst or 0

    same_state = vendor_state == buyer_state
    charged_cgst_sgst = cgst > 0 and sgst > 0
    charged_igst = igst > 0

    if same_state and charged_igst and not charged_cgst_sgst:
        return {"flagged": True, "reason": f"Vendor and buyer are both in state {vendor_state} "
                                            f"(intra-state) but IGST was charged instead of CGST+SGST."}
    if not same_state and charged_cgst_sgst and not charged_igst:
        return {"flagged": True, "reason": f"Vendor (state {vendor_state}) and buyer (state {buyer_state}) "
                                            f"are in different states (inter-state) but CGST+SGST was charged "
                                            f"instead of IGST."}
    return {"flagged": False, "reason": None}


def validate(invoice: dict, buyer_gstin: str = BUYER_GSTIN) -> list[dict]:
    """Runs both checks for one invoice. Returns a list of flag dicts (empty if clean)."""
    flags = []
    gstin = invoice.get("vendor_gstin")

    structure_result = validate_gstin_structure(gstin)
    if not structure_result["valid"]:
        flags.append({"check": "invalid_gstin", "reason": structure_result["reason"]})
        return flags  # skip tax-type check if the GSTIN itself is malformed

    tax_result = check_tax_type(
        gstin,
        invoice.get("cgst", 0),
        invoice.get("sgst", 0),
        invoice.get("igst", 0),
        buyer_gstin,
    )
    if tax_result["flagged"]:
        flags.append({"check": "tax_type_misclassification", "reason": tax_result["reason"]})

    return flags