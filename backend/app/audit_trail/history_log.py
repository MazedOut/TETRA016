"""Logs who did what and when across the audit trail (approvals, merges, resolutions).

Pipeline stage: Stage 7 - Audit trail
"""
import datetime as dt

def log_entry(actor: str, action: str, details: str = "") -> dict:
    """Builds one append-only history entry. Caller appends this to a ticket's
    `history` JSON list and saves the ticket."""
    return {
        "actor": actor,
        "action": action,
        "details": details,
        "timestamp": dt.datetime.utcnow().isoformat(),
    }

def append_history(ticket, actor: str, action: str, details: str = ""):
    """Mutates ticket.history in place (list of dicts). Caller still needs to
    db.commit() after calling this."""
    entry = log_entry(actor, action, details)
    if ticket.history is None:
        ticket.history = []
    ticket.history = ticket.history + [entry]  # new list so SQLAlchemy detects the JSON change
    return ticket