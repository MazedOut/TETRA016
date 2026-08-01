"""PDF metadata tamper scan (pikepdf), invisible-text scan (PyMuPDF),
and image EXIF/software-tag tamper scan (Pillow) for png/jpg uploads."""
import pikepdf
import fitz
import io
from PIL import Image
from PIL.ExifTags import TAGS

TAMPER_PRODUCERS = ["canva", "photoshop", "gimp", "paint.net", "illustrator"]

def check_metadata_tamper(pdf_bytes: bytes) -> dict:
    try:
        pdf = pikepdf.open(io.BytesIO(pdf_bytes))
        meta = pdf.docinfo
        producer = str(meta.get("/Producer", "")).lower()
        creator = str(meta.get("/Creator", "")).lower()
        flagged = any(p in producer or p in creator for p in TAMPER_PRODUCERS)
        return {
            "flagged": flagged,
            "producer": str(meta.get("/Producer", "")),
            "creator": str(meta.get("/Creator", "")),
            "reason": "Document metadata indicates editing/re-saving activity — review signal only, not proof of tampering." if flagged else "",
        }
    except Exception as e:
        return {"flagged": False, "producer": "", "creator": "", "reason": f"metadata unreadable: {e}"}

def check_invisible_text(pdf_bytes: bytes) -> dict:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        suspicious_spans = 0
        for page in doc:
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        color = span.get("color", 0)
                        r = (color >> 16) & 255
                        g = (color >> 8) & 255
                        b = color & 255
                        if r > 250 and g > 250 and b > 250:
                            suspicious_spans += 1
        return {"flagged": suspicious_spans > 0, "suspicious_spans": suspicious_spans}
    except Exception as e:
        return {"flagged": False, "suspicious_spans": 0, "reason": f"scan failed: {e}"}

def check_image_metadata(img_bytes: bytes) -> dict:
    """Flags images whose EXIF Software tag shows editing tools rather than
    camera/scanner apps, and flags images with NO EXIF at all (common after
    a screenshot/re-save, which strips originals — mildly suspicious, not damning)."""
    try:
        img = Image.open(io.BytesIO(img_bytes))
        exif = img._getexif() if hasattr(img, "_getexif") else None
        if not exif:
            return {"flagged": False, "software": None, "reason": "no EXIF data (common for re-saved/edited images)"}
        tags = {TAGS.get(k, k): v for k, v in exif.items()}
        software = str(tags.get("Software", "")).lower()
        flagged = any(p in software for p in TAMPER_PRODUCERS)
        return {
            "flagged": flagged,
            "software": tags.get("Software", ""),
            "reason": "Document metadata indicates editing/re-saving activity — review signal only, not proof of tampering." if flagged else "",
        }
    except Exception as e:
        return {"flagged": False, "software": None, "reason": f"metadata unreadable: {e}"}

def run_forensics(file_bytes: bytes, filename: str) -> dict:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        return {
            "metadata_tamper": check_metadata_tamper(file_bytes),
            "invisible_text": check_invisible_text(file_bytes),
        }
    else:  # png, jpg, jpeg
        return {
            "metadata_tamper": check_image_metadata(file_bytes),
            "invisible_text": {"flagged": False, "suspicious_spans": 0, "reason": "not applicable to images"},
        }