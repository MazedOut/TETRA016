"""
Hash tier (exact) + rapidfuzz tier (near-duplicate) duplicate detection.

Pipeline stage: Stage 4 - Reconciliation
"""
import hashlib
from rapidfuzz import fuzz

FUZZY_SIMILARITY_THRESHOLD = 85  # 0-100; below this, not considered a near-duplicate
AMOUNT_TOLERANCE = 0.01          # amounts must match within 1% to be "similar amount"


def _normalize_key(invoice: dict) -> str:
    """Build a normalized string key for exact-match hashing."""
    inv_num = str(invoice.get("invoice_number", "")).strip().upper()
    gstin = str(invoice.get("vendor_gstin", "")).strip().upper()
    amount = f"{float(invoice.get('total_amount', 0)):.2f}"
    date = invoice.get("invoice_date")
    date_str = date.strftime("%Y-%m-%d") if date else ""
    return f"{inv_num}|{gstin}|{amount}|{date_str}"


def _hash_key(invoice: dict) -> str:
    return hashlib.sha256(_normalize_key(invoice).encode("utf-8")).hexdigest()


def hash_tier_duplicates(invoices: list[dict]) -> list[dict]:
    """Exact-match duplicate detection via normalized-key hashing.
    Returns a list of flag dicts: {invoice_index, duplicate_of_index, method}."""
    seen = {}  # hash -> first index seen
    flags = []
    for idx, inv in enumerate(invoices):
        h = _hash_key(inv)
        if h in seen:
            flags.append({
                "invoice_index": idx,
                "duplicate_of_index": seen[h],
                "method": "hash_exact",
                "reason": f"Exact duplicate of invoice at index {seen[h]} "
                          f"(same invoice number, vendor GSTIN, amount, and date).",
            })
        else:
            seen[h] = idx
    return flags


def fuzzy_tier_duplicates(invoices: list[dict], already_flagged_indices: set[int]) -> list[dict]:
    """Near-duplicate detection, scoped to same-vendor + similar-amount pairs only,
    skipping anything the hash tier already caught."""
    flags = []
    n = len(invoices)
    for i in range(n):
        if i in already_flagged_indices:
            continue
        for j in range(i + 1, n):
            if j in already_flagged_indices:
                continue
            inv_a, inv_b = invoices[i], invoices[j]

            # Scope: same vendor only
            if inv_a.get("vendor_gstin") != inv_b.get("vendor_gstin"):
                continue

            # Scope: similar amount only
            amt_a, amt_b = float(inv_a.get("total_amount", 0)), float(inv_b.get("total_amount", 0))
            if amt_a == 0 or abs(amt_a - amt_b) / amt_a > AMOUNT_TOLERANCE:
                continue

            similarity = fuzz.ratio(
                str(inv_a.get("invoice_number", "")).upper(),
                str(inv_b.get("invoice_number", "")).upper(),
            )
            if similarity >= FUZZY_SIMILARITY_THRESHOLD:
                flags.append({
                    "invoice_index": j,
                    "duplicate_of_index": i,
                    "method": "fuzzy_near_duplicate",
                    "similarity_score": similarity,
                    "reason": f"Invoice number '{inv_b.get('invoice_number')}' is {similarity}% similar "
                              f"to '{inv_a.get('invoice_number')}' from the same vendor at the same amount "
                              f"— possible altered/typo'd duplicate.",
                })
    return flags


def detect_duplicates(invoices: list[dict]) -> list[dict]:
    """Runs hash tier first, then fuzzy tier on whatever's left. This is the
    function other modules (risk_scorer.py) will call."""
    hash_flags = hash_tier_duplicates(invoices)
    hash_flagged_indices = {f["invoice_index"] for f in hash_flags}
    fuzzy_flags = fuzzy_tier_duplicates(invoices, hash_flagged_indices)
    return hash_flags + fuzzy_flags