"""
Invoice <-> ledger matching.

Pipeline stage: Stage 4 - Reconciliation
Status: stub — not yet implemented.
"""


def not_implemented():
    raise NotImplementedError("backend/app/reconciliation/ledger_matcher.py is a scaffold stub. Implement this module.")

"""
Invoice <-> ledger matching.

Pipeline stage: Stage 4 - Reconciliation
"""
import pandas as pd


def load_ledger(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df["posting_date"] = pd.to_datetime(df["posting_date"])
    return df


def match_ledger(invoice: dict, ledger: pd.DataFrame) -> dict:
    """Finds the ledger row matching this invoice by invoice_number + vendor_name.
    Returns {'matched': True, 'ledger_row': <dict>} or
            {'matched': False, 'flag': {...}} if no ledger entry exists."""
    inv_num = str(invoice.get("invoice_number", "")).strip()
    vendor = str(invoice.get("vendor_name", "")).strip()

    match = ledger[
        (ledger["invoice_number"].str.strip() == inv_num)
        & (ledger["vendor_name"].str.strip() == vendor)
    ]

    if match.empty:
        return {
            "matched": False,
            "flag": {
                "check": "missing_ledger_entry",
                "reason": f"Invoice '{inv_num}' from '{vendor}' has no corresponding "
                          f"entry in the purchase ledger — may be unposted or fabricated.",
            },
        }

    return {"matched": True, "ledger_row": match.iloc[0].to_dict()}