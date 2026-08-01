"""
Auto-sorts invoices into folders by vendor/category; unclassified -> 'extra'; missing critical data -> 'needs review'.

Pipeline stage: Stage 3 - Classification
Status: stub — not yet implemented.
"""


def not_implemented():
    raise NotImplementedError("backend/app/classification/folder_sorter.py is a scaffold stub. Implement this module.")

"""
Auto-sorts invoices into folders by vendor/category; unclassified -> 'extra'; missing critical data -> 'needs review'.

Pipeline stage: Stage 3 - Classification
"""
from app.config import CRITICAL_FIELDS
from app.classification.vendor_cache import VendorCache

NEEDS_REVIEW_FOLDER = "needs review"
EXTRA_FOLDER = "extra"


def _has_missing_critical_fields(invoice: dict) -> list[str]:
    """Returns the list of critical fields that are missing/empty on this invoice."""
    missing = []
    for field in CRITICAL_FIELDS:
        value = invoice.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(field)
    return missing


def sort_invoice(invoice: dict, cache: VendorCache) -> dict:
    """Determines which folder an invoice belongs in.
    Returns {'folder': str, 'reason': str}."""
    missing_fields = _has_missing_critical_fields(invoice)
    if missing_fields:
        return {
            "folder": NEEDS_REVIEW_FOLDER,
            "reason": f"Missing critical field(s): {', '.join(missing_fields)}.",
        }

    vendor_name = invoice.get("vendor_name")
    category = cache.get(vendor_name)

    if category is not None:
        return {
            "folder": category,
            "reason": f"Sorted by cached category for known vendor '{vendor_name}'.",
        }

    return {
        "folder": EXTRA_FOLDER,
        "reason": f"Vendor '{vendor_name}' not yet classified — filed as extra pending classification.",
    }


def sort_batch(invoices: list[dict], cache: VendorCache) -> list[dict]:
    """Sorts a full batch of invoices. Returns a list of {'invoice_number', 'folder', 'reason'}."""
    results = []
    for inv in invoices:
        result = sort_invoice(invoice=inv, cache=cache)
        results.append({
            "invoice_number": inv.get("invoice_number"),
            "folder": result["folder"],
            "reason": result["reason"],
        })
    return results