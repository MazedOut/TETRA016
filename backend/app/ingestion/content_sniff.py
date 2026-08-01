"""Tier 2: OCR-emptiness check to catch non-invoice uploads. No AI."""
import fitz  # pymupdf
from PIL import Image
import pytesseract
import io

def has_extractable_content(filename: str, data: bytes) -> tuple[bool, str]:
    ext = filename.rsplit(".", 1)[-1].lower()
    try:
        if ext == "pdf":
            doc = fitz.open(stream=data, filetype="pdf")
            text = "".join(p.get_text() for p in doc)
            if text.strip():
                return True, ""
            # scanned pdf, try ocr on first page
            pix = doc[0].get_pixmap()
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text = pytesseract.image_to_string(img)
        else:
            img = Image.open(io.BytesIO(data))
            text = pytesseract.image_to_string(img)
        return (len(text.strip()) > 5), "" if text.strip() else "no readable text found"
    except Exception as e:
        return False, f"unreadable: {e}"