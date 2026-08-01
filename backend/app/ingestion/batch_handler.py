"""Bulk upload handling; builds invalid-file summary for skip/retry/review.
Also runs extraction + forensics on every accepted file."""
from .file_validator import validate
from .content_sniff import has_extractable_content
from app.extraction.pipeline import extract_invoice
from app.reconciliation.forensics import run_forensics

def process_batch(files: list[tuple[str, bytes]]) -> dict:
    """files: list of (filename, raw_bytes). Returns processed + rejected lists."""
    processed, rejected = [], []
    for filename, data in files:
        ok, reason = validate(filename, data)
        if not ok:
            rejected.append({"filename": filename, "reason": reason})
            continue
        readable, reason = has_extractable_content(filename, data)
        if not readable:
            rejected.append({"filename": filename, "reason": reason})
            continue

        try:
            extraction = extract_invoice(filename, data)
        except Exception as e:
            rejected.append({"filename": filename, "reason": f"extraction failed: {e}"})
            continue

        forensics = run_forensics(data, filename)

        processed.append({
            "filename": filename,
            "extraction": extraction,
            "forensics": forensics,
        })

    return {"processed": processed, "rejected": rejected, "total": len(files)}