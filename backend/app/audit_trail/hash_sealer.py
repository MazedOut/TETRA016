"""SHA-256 seals every finalized record; breaks the seal badge if edited afterward."""
import hmac
import hashlib
import json
import datetime as dt
from app.config import GEMINI_API_KEY  # reuse as HMAC secret for demo

SEAL_SECRET = (GEMINI_API_KEY or "tetra-hackathon-seal-secret-2026").encode()

def seal(record: dict) -> str:
    """Deterministic hash over the finalized invoice record."""
    canonical = json.dumps(record, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()

def verify(record: dict, expected_hash: str) -> bool:
    return seal(record) == expected_hash

def generate_signature(record: dict) -> str:
    """HMAC-SHA256 signature using server secret — proves the server sealed this data."""
    canonical = json.dumps(record, sort_keys=True, default=str)
    return hmac.new(SEAL_SECRET, canonical.encode(), hashlib.sha256).hexdigest()

def verify_signature(record: dict, expected_sig: str) -> bool:
    """Verify HMAC signature matches."""
    return hmac.compare_digest(generate_signature(record), expected_sig)

def build_seal_record(invoice) -> dict:
    """Build the canonical record dict from an Invoice ORM object for sealing."""
    return {
        "invoice_number": invoice.invoice_number,
        "vendor_name": invoice.vendor_name,
        "vendor_gstin": invoice.vendor_gstin,
        "total_amount": invoice.total_amount,
        "taxable_value": invoice.taxable_value,
        "cgst": invoice.cgst,
        "sgst": invoice.sgst,
        "igst": invoice.igst,
    }

def generate_full_seal(invoice) -> dict:
    """Generate complete seal payload for an invoice ORM object."""
    record = build_seal_record(invoice)
    content_hash = seal(record)
    signature = generate_signature(record)
    sealed_at = dt.datetime.utcnow()
    return {
        "hash": content_hash,
        "signature": signature,
        "algorithm": "HMAC-SHA256",
        "sealed_at": sealed_at.isoformat(),
        "sealed_fields": list(record.keys()),
    }

def verify_full_seal(invoice, stored_hash: str, stored_signature: str) -> dict:
    """Verify both content hash and HMAC signature."""
    record = build_seal_record(invoice)
    current_hash = seal(record)
    hash_valid = current_hash == stored_hash
    sig_valid = verify_signature(record, stored_signature)
    return {
        "valid": hash_valid and sig_valid,
        "hash_valid": hash_valid,
        "signature_valid": sig_valid,
        "current_hash": current_hash,
        "stored_hash": stored_hash,
        "tampered_fields": [] if hash_valid else _detect_tampered_fields(invoice, stored_hash),
    }

def _detect_tampered_fields(invoice, stored_hash: str) -> list:
    """Best-effort detection of which fields changed (for UI display)."""
    return ["one or more sealed fields have been modified since sealing"]