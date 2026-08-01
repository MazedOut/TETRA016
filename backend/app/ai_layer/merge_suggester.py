"""Proposes ticket merges with a stated reason; user must confirm/edit/reject.

Pipeline stage: Stage 6 - AI layer
"""
from rapidfuzz import fuzz
import re

MERGE_THRESHOLD = 85

_SUFFIX_MAP = {
    r"\bpvt\b": "private",
    r"\bltd\b": "limited",
    r"\bco\b": "company",
}

def _normalize(name: str) -> str:
    name = name.lower()
    for pat, repl in _SUFFIX_MAP.items():
        name = re.sub(pat, repl, name)
    return re.sub(r"[^\w\s]", "", name).strip()

def _shared_checks(a: dict, b: dict) -> list[str]:
    a_checks = {c["check"] for c in a.get("contributing_checks", [])}
    b_checks = {c["check"] for c in b.get("contributing_checks", [])}
    return sorted(a_checks & b_checks)

def suggest_merges(tickets: list[dict]) -> list[dict]:
    suggestions = []
    for i in range(len(tickets)):
        for j in range(i + 1, len(tickets)):
            a, b = tickets[i], tickets[j]
            name_sim = fuzz.token_set_ratio(
                _normalize(a.get("vendor_name", "")), _normalize(b.get("vendor_name", ""))
            )
            shared = _shared_checks(a, b)
            if name_sim >= MERGE_THRESHOLD and shared:
                suggestions.append({
                    "ticket_ids": [a["invoice_id"], b["invoice_id"]],
                    "vendor_name_similarity": name_sim,
                    "shared_checks": shared,
                    "reason": (
                        f"Same vendor ('{a.get('vendor_name')}' ~ '{b.get('vendor_name')}', "
                        f"{name_sim}% match) flagged for the same issue(s): {', '.join(shared)}."
                    ),
                    "status": "pending_confirmation",
                })
    return suggestions