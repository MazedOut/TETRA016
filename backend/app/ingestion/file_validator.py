"""Tier 1: file-format and corruption check. No AI."""
ALLOWED_EXT = {"pdf", "png", "jpg", "jpeg"}
MAX_MB = 15

def validate(filename: str, data: bytes) -> tuple[bool, str]:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXT:
        return False, f"unsupported format .{ext}"
    if len(data) > MAX_MB * 1024 * 1024:
        return False, f"exceeds {MAX_MB}MB"
    if len(data) == 0:
        return False, "empty file"
    return True, ""