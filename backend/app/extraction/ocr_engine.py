"""Tesseract wrapper - free local baseline extraction."""
import fitz
from PIL import Image
import pytesseract
import io

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def _to_image(filename: str, data: bytes) -> Image.Image:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        doc = fitz.open(stream=data, filetype="pdf")
        pix = doc[0].get_pixmap(dpi=200)
        return Image.open(io.BytesIO(pix.tobytes("png")))
    return Image.open(io.BytesIO(data))

def run_ocr(filename: str, data: bytes) -> dict:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        try:
            doc = fitz.open(stream=data, filetype="pdf")
            text = doc[0].get_text()
            if text and len(text.strip()) > 20:
                return {"text": text, "avg_conf": 98.0, "source": "pdf_text"}
        except Exception:
            pass

    img = _to_image(filename, data)
    text = pytesseract.image_to_string(img)
    conf_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    confs = [int(c) for c in conf_data["conf"] if c != "-1"]
    avg_conf = sum(confs) / len(confs) if confs else 0.0
    return {"text": text, "avg_conf": avg_conf, "source": "tesseract"}