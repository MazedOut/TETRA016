"""Logs who did what and when across the audit trail (approvals, merges, resolutions).

Pipeline stage: Stage 7 - Audit trail
"""
import datetime as dt

EVENT_CATEGORIES = {
    "ingestion": {"icon": "📥", "label": "Document Ingested", "category": "pipeline"},
    "extraction": {"icon": "🔍", "label": "Fields Extracted", "category": "pipeline"},
    "classification": {"icon": "📂", "label": "Auto-Classified", "category": "pipeline"},
    "gstin_validation": {"icon": "🏛️", "label": "GSTIN Validated", "category": "validation"},
    "gstin_validation_failed": {"icon": "⚠️", "label": "GSTIN Validation Failed", "category": "validation"},
    "metadata_scan": {"icon": "🔬", "label": "Metadata Scanned", "category": "forensics"},
    "metadata_tamper_detected": {"icon": "🚨", "label": "Metadata Tampering Detected", "category": "forensics"},
    "invisible_text_detected": {"icon": "👻", "label": "Hidden Text Detected", "category": "forensics"},
    "duplicate_check": {"icon": "📋", "label": "Duplicate Check", "category": "validation"},
    "duplicate_detected": {"icon": "⚠️", "label": "Duplicate Detected", "category": "validation"},
    "vendor_check": {"icon": "🏪", "label": "Vendor Verified", "category": "validation"},
    "vendor_anomaly": {"icon": "⚠️", "label": "Vendor Anomaly Detected", "category": "validation"},
    "risk_scoring": {"icon": "📊", "label": "Risk Score Computed", "category": "scoring"},
    "ai_narrative": {"icon": "🤖", "label": "AI Narrative Generated", "category": "ai"},
    "ai_msme_translation": {"icon": "💬", "label": "MSME Translation Generated", "category": "ai"},
    "ticket_created": {"icon": "🎫", "label": "Exception Ticket Created", "category": "audit"},
    "seal_applied": {"icon": "🔒", "label": "Cryptographically Sealed", "category": "security"},
    "seal_verified": {"icon": "✅", "label": "Seal Verified", "category": "security"},
    "seal_broken": {"icon": "🔓", "label": "Seal Integrity Failed", "category": "security"},
    "field_edited": {"icon": "✏️", "label": "Field Corrected", "category": "audit"},
    "status_changed": {"icon": "🔄", "label": "Status Changed", "category": "audit"},
    "resolved": {"icon": "✅", "label": "Ticket Resolved", "category": "audit"},
    "escalated": {"icon": "🚀", "label": "Ticket Escalated", "category": "audit"},
    "marked_false_positive": {"icon": "🏳️", "label": "Marked False Positive", "category": "audit"},
    "merged": {"icon": "🔀", "label": "Tickets Merged", "category": "audit"},
}

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

def build_pipeline_event(event_type: str, detail: str = "", actor: str = "system") -> dict:
    """Build a rich pipeline event entry with icon and category metadata."""
    meta = EVENT_CATEGORIES.get(event_type, {"icon": "📌", "label": event_type, "category": "other"})
    return {
        "event": event_type,
        "icon": meta["icon"],
        "label": meta["label"],
        "category": meta["category"],
        "detail": detail,
        "actor": actor,
        "timestamp": dt.datetime.utcnow().isoformat(),
    }

def build_audit_trail(invoice, tickets) -> list:
    """Build a complete, chronological audit trail by merging all event sources.
    
    Combines:
    1. Pipeline processing events (from invoice.pipeline_log)
    2. Ticket history entries (from all associated tickets)
    3. Field edit history (from invoice.edit_history)
    
    Returns a sorted list of events, newest first.
    """
    events = []
    
    # 1. Pipeline log events
    if invoice.pipeline_log:
        for entry in invoice.pipeline_log:
            meta = EVENT_CATEGORIES.get(entry.get("event", ""), {})
            events.append({
                "event": entry.get("event", "unknown"),
                "icon": meta.get("icon", entry.get("icon", "📌")),
                "label": meta.get("label", entry.get("label", entry.get("event", "Event"))),
                "category": meta.get("category", entry.get("category", "pipeline")),
                "detail": entry.get("detail", ""),
                "actor": entry.get("actor", "system"),
                "timestamp": entry.get("timestamp", ""),
            })
    
    # 2. Ticket history events
    for ticket in tickets:
        ticket_label = f"TCK-{ticket.id}"
        if ticket.history:
            for entry in ticket.history:
                action = entry.get("action", "")
                event_type = action.split(":")[0] if ":" in action else action
                meta = EVENT_CATEGORIES.get(event_type, {})
                events.append({
                    "event": event_type,
                    "icon": meta.get("icon", "🎫"),
                    "label": meta.get("label", action),
                    "category": meta.get("category", "audit"),
                    "detail": f"[{ticket_label} · {ticket.exception_type}] {entry.get('details', '')}".strip(),
                    "actor": entry.get("actor", "system"),
                    "timestamp": entry.get("timestamp", ""),
                })
    
    # 3. Field edit history
    if invoice.edit_history:
        for entry in invoice.edit_history:
            events.append({
                "event": "field_edited",
                "icon": "✏️",
                "label": "Field Corrected",
                "category": "audit",
                "detail": f"{entry.get('field', '?')} changed from '{entry.get('old_value', '')}' to '{entry.get('new_value', '')}'",
                "actor": entry.get("actor", "unknown"),
                "timestamp": entry.get("timestamp", ""),
            })
    
    # 4. Seal events (derived from invoice fields)
    if hasattr(invoice, 'sealed_at') and invoice.sealed_at:
        events.append({
            "event": "seal_applied",
            "icon": "🔒",
            "label": "Cryptographically Sealed",
            "category": "security",
            "detail": f"SHA-256 hash: {(invoice.record_hash or '')[:16]}…",
            "actor": "system",
            "timestamp": invoice.sealed_at.isoformat() if hasattr(invoice.sealed_at, 'isoformat') else str(invoice.sealed_at),
        })
    
    # Sort by timestamp (newest first for timeline display)
    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return events