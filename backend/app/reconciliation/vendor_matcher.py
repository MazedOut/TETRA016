"""
Invoice <-> vendor master matching; phantom/unlisted vendor detection.

Pipeline stage: Stage 4 - Reconciliation
"""

import pandas as pd
from rapidfuzz import fuzz

TYPO_SQUAT_MIN_SIMILARITY = 80


def load_vendor_master(csv_path: str) -> pd.DataFrame:
    return pd.read_csv(csv_path)


def match_vendor(invoice: dict, vendor_master: pd.DataFrame) -> dict:
    """Checks one invoice's vendor against the master list.
    Returns a flag dict, or {'flagged': False} if the vendor is legitimate."""
    inv_name = str(invoice.get("vendor_name", "")).strip()
    inv_gstin = str(invoice.get("vendor_gstin", "")).strip().upper()

    # 1. Exact match: name AND gstin both match a master row -> legitimate, no flag
    exact = vendor_master[
        (vendor_master["vendor_name"].str.strip() == inv_name)
        & (vendor_master["gstin"].str.strip().str.upper() == inv_gstin)
    ]
    if not exact.empty:
        return {"flagged": False}

    # 2. Check similarity against every master vendor name to find the closest one
    best_match = None
    best_score = 0
    for _, row in vendor_master.iterrows():
        score = fuzz.ratio(inv_name.upper(), str(row["vendor_name"]).strip().upper())
        if score > best_score:
            best_score = score
            best_match = row["vendor_name"]

    # 3. Typo-squat band: close enough to be deliberate impersonation, not an exact match
    #    (exact name+GSTIN matches are already filtered out above)
    if best_score >= TYPO_SQUAT_MIN_SIMILARITY:
        return {
            "flagged": True,
            "check": "typo_squatting_vendor",
            "reason": f"Vendor name '{inv_name}' is {best_score:.1f}% similar to known vendor "
                      f"'{best_match}' but GSTIN doesn't match — possible impersonation/typo-squatting.",
        }

    # 4. Nothing close at all -> phantom vendor, not in our records
    return {
        "flagged": True,
        "check": "phantom_vendor",
        "reason": f"Vendor '{inv_name}' is not in the vendor master and has no close match "
                  f"(best similarity: {best_score:.1f}% to '{best_match}') — unrecognized vendor.",
    }