"""
Full-scan pass cross-checking filed invoices against their folder. No AI, pure lookup/comparison.

Pipeline stage: Stage 3 - Classification
Status: stub — not yet implemented.
"""


def not_implemented():
    raise NotImplementedError("backend/app/classification/misfile_scanner.py is a scaffold stub. Implement this module.")

"""
Full-scan pass cross-checking filed invoices against their folder. No AI, pure lookup/comparison.

Pipeline stage: Stage 3 - Classification
"""
from app.classification.vendor_cache import VendorCache
from app.classification.folder_sorter import sort_invoice, NEEDS_REVIEW_FOLDER, EXTRA_FOLDER


def scan_filed_invoice(invoice: dict, cache: VendorCache) -> dict:
    """Re-checks one already-filed invoice (must have a 'folder' key) against
    what it SHOULD currently be filed as. Returns {'misfiled': bool, 'flag': dict or None}."""
    current_folder = invoice.get("folder")
    if current_folder is None:
        return {"misfiled": False, "flag": None}  # nothing to compare against, skip

    expected = sort_invoice(invoice, cache)
    expected_folder = expected["folder"]

    if current_folder == expected_folder:
        return {"misfiled": False, "flag": None}

    return {
        "misfiled": True,
        "flag": {
            "check": "misfiled_invoice",
            "invoice_number": invoice.get("invoice_number"),
            "current_folder": current_folder,
            "expected_folder": expected_folder,
            "reason": f"Invoice '{invoice.get('invoice_number')}' is filed under "
                      f"'{current_folder}' but should currently be under '{expected_folder}' "
                      f"({expected['reason']}).",
        },
    }


def scan_batch(filed_invoices: list[dict], cache: VendorCache) -> list[dict]:
    """Runs the misfile check across a full batch of already-filed invoices.
    Returns only the flags for invoices that ARE misfiled (empty list if all clean)."""
    flags = []
    for inv in filed_invoices:
        result = scan_filed_invoice(inv, cache)
        if result["misfiled"]:
            flags.append(result["flag"])
    return flags