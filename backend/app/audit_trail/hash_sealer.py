"""SHA-256 seals every finalized record; breaks the seal badge if edited afterward."""
import hashlib
import json

def seal(record: dict) -> str:
    """Deterministic hash over the finalized invoice record."""
    canonical = json.dumps(record, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()

def verify(record: dict, expected_hash: str) -> bool:
    return seal(record) == expected_hash