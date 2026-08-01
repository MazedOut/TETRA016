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

def build_forensic_report(file_bytes: bytes, filename: str, invoice_date=None) -> dict:
    """Build a comprehensive forensic report with OS detection, date analysis, and risk indicators."""
    ext = filename.rsplit(".", 1)[-1].lower()
    report = {
        "filename": filename,
        "file_size_bytes": len(file_bytes),
        "file_type": ext,
        "producer": None,
        "creator": None,
        "creation_date": None,
        "modification_date": None,
        "os_platform": None,
        "page_count": None,
        "software_flags": [],
        "date_anomalies": [],
        "risk_indicators": [],
        "risk_score_contribution": 0,
        "metadata_raw": {},
    }
    
    if ext != "pdf":
        img_result = check_image_metadata(file_bytes)
        report["producer"] = img_result.get("software")
        if img_result["flagged"]:
            report["software_flags"].append({
                "tool": img_result.get("software", "unknown"),
                "severity": "high",
                "message": f"Image edited with {img_result.get('software', 'unknown editing software')}"
            })
            report["risk_score_contribution"] += 15
        return report
    
    # ---- PDF-specific analysis ----
    import io
    try:
        pdf = pikepdf.open(io.BytesIO(file_bytes))
        meta = pdf.docinfo
        
        report["producer"] = str(meta.get("/Producer", "")) or None
        report["creator"] = str(meta.get("/Creator", "")) or None
        report["creation_date"] = str(meta.get("/CreationDate", "")) or None
        report["modification_date"] = str(meta.get("/ModDate", "")) or None
        
        # Store raw metadata
        report["metadata_raw"] = {
            k: str(v) for k, v in (meta or {}).items()
        }
        
        # OS/Platform detection from Producer/Creator strings
        producer_lower = (report["producer"] or "").lower()
        creator_lower = (report["creator"] or "").lower()
        combined = f"{producer_lower} {creator_lower}"
        
        if any(x in combined for x in ["linux", "ubuntu", "fedora", "debian"]):
            report["os_platform"] = "Linux"
        elif any(x in combined for x in ["mac", "macos", "quartz"]):
            report["os_platform"] = "macOS"
        elif any(x in combined for x in ["windows", "microsoft", "win32"]):
            report["os_platform"] = "Windows"
        else:
            report["os_platform"] = "Unknown"
        
        # Software flag detection (expanded list)
        SUSPICIOUS_SOFTWARE = {
            "photoshop": ("Adobe Photoshop", "high", 20),
            "canva": ("Canva", "high", 20),
            "gimp": ("GIMP", "high", 18),
            "paint.net": ("Paint.NET", "high", 18),
            "illustrator": ("Adobe Illustrator", "medium", 15),
            "inkscape": ("Inkscape", "medium", 12),
            "libreoffice impress": ("LibreOffice Impress", "medium", 10),
            "openoffice impress": ("OpenOffice Impress", "medium", 10),
            "figma": ("Figma", "high", 18),
            "sketch": ("Sketch", "high", 18),
            "affinity": ("Affinity Suite", "medium", 15),
        }
        
        for keyword, (tool_name, severity, risk_pts) in SUSPICIOUS_SOFTWARE.items():
            if keyword in combined:
                report["software_flags"].append({
                    "tool": tool_name,
                    "severity": severity,
                    "message": f"Document generated via {tool_name} — image editing software, not standard invoicing tools",
                    "detected_in": "producer" if keyword in producer_lower else "creator",
                })
                report["risk_score_contribution"] += risk_pts
                break  # one flag per document is sufficient
        
        # Date analysis
        if report["creation_date"]:
            try:
                date_str = report["creation_date"]
                if date_str.startswith("D:"):
                    date_str = date_str[2:16]
                    from datetime import datetime
                    creation_dt = datetime.strptime(date_str, "%Y%m%d%H%M%S")
                    
                    # Check: creation date in the future
                    if creation_dt > datetime.utcnow():
                        report["date_anomalies"].append({
                            "type": "future_creation",
                            "severity": "high",
                            "message": f"Document creation date ({creation_dt.strftime('%Y-%m-%d')}) is in the future",
                        })
                        report["risk_score_contribution"] += 15
                    
                    # Check: creation date much later than invoice date
                    if invoice_date:
                        from datetime import timedelta
                        inv_dt = invoice_date if hasattr(invoice_date, 'date') else None
                        if inv_dt and (creation_dt - inv_dt).days > 30:
                            report["date_anomalies"].append({
                                "type": "late_creation",
                                "severity": "medium",
                                "message": f"PDF created {(creation_dt - inv_dt).days} days after invoice date — possible back-dated document",
                            })
                            report["risk_score_contribution"] += 10
            except (ValueError, TypeError):
                pass
        
        # Page count via fitz
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            report["page_count"] = doc.page_count
            doc.close()
        except Exception:
            pass
        
        # Build risk indicators summary
        if report["software_flags"]:
            report["risk_indicators"].append("Suspicious creator software detected")
        if report["date_anomalies"]:
            report["risk_indicators"].append("Date anomalies found")
        if not report["producer"] and not report["creator"]:
            report["risk_indicators"].append("No metadata — possible stripped/sanitized document")
            report["risk_score_contribution"] += 5
        
        pdf.close()
        
    except Exception as e:
        report["risk_indicators"].append(f"Metadata extraction failed: {str(e)}")
    
    return report

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