"""
Generates 50-60 realistic PDF invoices using ReportLab, with intentional
anomalies deliberately planted for demo purposes:
  - exact duplicate pair ("INV-401")
  - near-duplicate pair ("INV-501" vs "INV-50l")
  - invalid/malformed GSTIN checksum (INV-601, INV-9999)
  - sequence gap within vendor invoice numbering (INV-101, 102, [103 missing], 104)
  - amount/date mismatches vs ledger
  - vendor with Photoshop/Canva PDF metadata signature
  - vendor activity anomaly (z-score spike)
  - unpaid/overdue past 45 days (MSME 43B(h) case)
  - tax calculation math error
  - phantom / typo-squatting vendor
  - multi-signal high-risk invoice
Output lands in backend/synthetic_data/output/invoices/.
"""
import os
import sys
import io
import datetime
import pikepdf
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from synthetic_data.generate_vendor_master import generate_vendor_master
from app.config import BUYER_GSTIN

HOME_STATE = BUYER_GSTIN[:2] # "24" (Gujarat)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
INVOICES_DIR = os.path.join(OUTPUT_DIR, "invoices")

vm_df = generate_vendor_master()
VALID_GSTIN_MAP = dict(zip(vm_df["vendor_name"], vm_df["gstin"]))

# List of demo invoices covering all scenarios with valid GSTINs for clean vendors
DEMO_INVOICES = [
    # 1. Sharma Traders — sequence gap series (INV-101, 102, missing 103, 104)
    {"filename": "INV-101.pdf", "invoice_number": "INV-101", "vendor_name": "Sharma Traders", "vendor_gstin": VALID_GSTIN_MAP["Sharma Traders"], "invoice_date": "22-07-2026", "taxable_value": 10000.00, "cgst": 900.00, "sgst": 900.00, "igst": 0.0, "total_amount": 11800.00},
    {"filename": "INV-102.pdf", "invoice_number": "INV-102", "vendor_name": "Sharma Traders", "vendor_gstin": VALID_GSTIN_MAP["Sharma Traders"], "invoice_date": "24-07-2026", "taxable_value": 20000.00, "cgst": 1800.00, "sgst": 1800.00, "igst": 0.0, "total_amount": 23600.00},
    # Note: INV-103 missing!
    {"filename": "INV-104.pdf", "invoice_number": "INV-104", "vendor_name": "Sharma Traders", "vendor_gstin": VALID_GSTIN_MAP["Sharma Traders"], "invoice_date": "29-07-2026", "taxable_value": 8000.00, "cgst": 720.00, "sgst": 720.00, "igst": 0.0, "total_amount": 9440.00},

    # 2. Bansal Electricals — MSME overdue case (60 days old, unpaid) (State 27 -> IGST 18%)
    {"filename": "INV-201.pdf", "invoice_number": "INV-201", "vendor_name": "Bansal Electricals", "vendor_gstin": VALID_GSTIN_MAP["Bansal Electricals"], "invoice_date": "01-06-2026", "taxable_value": 40000.00, "cgst": 0.0, "sgst": 0.0, "igst": 7200.00, "total_amount": 47200.00, "is_paid": False},
    {"filename": "INV-202.pdf", "invoice_number": "INV-202", "vendor_name": "Bansal Electricals", "vendor_gstin": VALID_GSTIN_MAP["Bansal Electricals"], "invoice_date": "10-06-2026", "taxable_value": 13000.00, "cgst": 0.0, "sgst": 0.0, "igst": 2340.00, "total_amount": 15340.00, "is_paid": False},

    # 3. Patel Logistics — Vendor anomaly check candidate (5 normal ~₹8.5k, 1 huge ₹1,45,000 spike) (State 24 -> CGST+SGST)
    {"filename": "INV-301.pdf", "invoice_number": "INV-301", "vendor_name": "Patel Logistics", "vendor_gstin": VALID_GSTIN_MAP["Patel Logistics"], "invoice_date": "27-07-2026", "taxable_value": 7000.00, "cgst": 630.00, "sgst": 630.00, "igst": 0.0, "total_amount": 8260.00},
    {"filename": "INV-302.pdf", "invoice_number": "INV-302", "vendor_name": "Patel Logistics", "vendor_gstin": VALID_GSTIN_MAP["Patel Logistics"], "invoice_date": "28-07-2026", "taxable_value": 7500.00, "cgst": 675.00, "sgst": 675.00, "igst": 0.0, "total_amount": 8850.00},
    {"filename": "INV-303.pdf", "invoice_number": "INV-303", "vendor_name": "Patel Logistics", "vendor_gstin": VALID_GSTIN_MAP["Patel Logistics"], "invoice_date": "29-07-2026", "taxable_value": 7200.00, "cgst": 648.00, "sgst": 648.00, "igst": 0.0, "total_amount": 8496.00},
    {"filename": "INV-304.pdf", "invoice_number": "INV-304", "vendor_name": "Patel Logistics", "vendor_gstin": VALID_GSTIN_MAP["Patel Logistics"], "invoice_date": "30-07-2026", "taxable_value": 7100.00, "cgst": 639.00, "sgst": 639.00, "igst": 0.0, "total_amount": 8378.00},
    {"filename": "INV-305.pdf", "invoice_number": "INV-305", "vendor_name": "Patel Logistics", "vendor_gstin": VALID_GSTIN_MAP["Patel Logistics"], "invoice_date": "31-07-2026", "taxable_value": 7300.00, "cgst": 657.00, "sgst": 657.00, "igst": 0.0, "total_amount": 8614.00},
    {"filename": "INV-306.pdf", "invoice_number": "INV-306", "vendor_name": "Patel Logistics", "vendor_gstin": VALID_GSTIN_MAP["Patel Logistics"], "invoice_date": "01-08-2026", "taxable_value": 122881.00, "cgst": 11059.00, "sgst": 11059.00, "igst": 0.0, "total_amount": 145000.00}, # Z-SCORE ANOMALY SPIKE!

    # 4. Iyer & Sons — Exact duplicate pair (State 33 -> IGST 18%)
    {"filename": "INV-401_A.pdf", "invoice_number": "INV-401", "vendor_name": "Iyer & Sons", "vendor_gstin": VALID_GSTIN_MAP["Iyer & Sons"], "invoice_date": "25-07-2026", "taxable_value": 5000.00, "cgst": 0.0, "sgst": 0.0, "igst": 900.00, "total_amount": 5900.00},
    {"filename": "INV-401_B.pdf", "invoice_number": "INV-401", "vendor_name": "Iyer & Sons", "vendor_gstin": VALID_GSTIN_MAP["Iyer & Sons"], "invoice_date": "25-07-2026", "taxable_value": 5000.00, "cgst": 0.0, "sgst": 0.0, "igst": 900.00, "total_amount": 5900.00}, # EXACT DUP

    # 5. Nair Textiles — Fuzzy near-duplicate pair ("INV-501" vs "INV-50l") (State 32 -> IGST 18%)
    {"filename": "INV-501.pdf", "invoice_number": "INV-501", "vendor_name": "Nair Textiles", "vendor_gstin": VALID_GSTIN_MAP["Nair Textiles"], "invoice_date": "26-07-2026", "taxable_value": 28000.00, "cgst": 0.0, "sgst": 0.0, "igst": 5040.00, "total_amount": 33040.00},
    {"filename": "INV-50l_fuzzy.pdf", "invoice_number": "INV-50l", "vendor_name": "Nair Textiles", "vendor_gstin": VALID_GSTIN_MAP["Nair Textiles"], "invoice_date": "26-07-2026", "taxable_value": 28000.00, "cgst": 0.0, "sgst": 0.0, "igst": 5040.00, "total_amount": 33040.00}, # FUZZY DUP

    # 6. Gupta Packaging — Deliberately invalid GSTIN checksum
    {"filename": "INV-601.pdf", "invoice_number": "INV-601", "vendor_name": "Gupta Packaging", "vendor_gstin": "07AAACG3344P1ZX", "invoice_date": "28-07-2026", "taxable_value": 6000.00, "cgst": 0.0, "sgst": 0.0, "igst": 1080.00, "total_amount": 7080.00}, # BAD GSTIN

    # 7. Reddy Chemicals — Amount mismatch vs ledger
    {"filename": "INV-701.pdf", "invoice_number": "INV-701", "vendor_name": "Reddy Chemicals", "vendor_gstin": VALID_GSTIN_MAP["Reddy Chemicals"], "invoice_date": "30-07-2026", "taxable_value": 18000.00, "cgst": 0.0, "sgst": 0.0, "igst": 3240.00, "total_amount": 21240.00}, # Ledger has 28500.00

    # 8. Verma Hardware — Date mismatch vs ledger
    {"filename": "INV-801.pdf", "invoice_number": "INV-801", "vendor_name": "Verma Hardware", "vendor_gstin": VALID_GSTIN_MAP["Verma Hardware"], "invoice_date": "01-07-2026", "taxable_value": 12000.00, "cgst": 0.0, "sgst": 0.0, "igst": 2160.00, "total_amount": 14160.00}, # Ledger posted 25-07-2026 (24 days delta)

    # 9. Kapoor Consultants — Missing ledger entry
    {"filename": "INV-901.pdf", "invoice_number": "INV-901", "vendor_name": "Kapoor Consultants", "vendor_gstin": VALID_GSTIN_MAP["Kapoor Consultants"], "invoice_date": "31-07-2026", "taxable_value": 25000.00, "cgst": 0.0, "sgst": 0.0, "igst": 4500.00, "total_amount": 29500.00}, # Omitted from ledger

    # 10. Joshi Fabrication — PDF metadata tamper (Canva/Photoshop metadata tag)
    {"filename": "INV-1001.pdf", "invoice_number": "INV-1001", "vendor_name": "Joshi Fabrication", "vendor_gstin": VALID_GSTIN_MAP["Joshi Fabrication"], "invoice_date": "21-07-2026", "taxable_value": 16000.00, "cgst": 1440.00, "sgst": 1440.00, "igst": 0.0, "total_amount": 18880.00, "tamper_metadata": True},

    # 11. Menon Furniture — Internal math mismatch
    {"filename": "INV-1101.pdf", "invoice_number": "INV-1101", "vendor_name": "Menon Furniture", "vendor_gstin": VALID_GSTIN_MAP["Menon Furniture"], "invoice_date": "20-07-2026", "taxable_value": 35000.00, "cgst": 0.0, "sgst": 0.0, "igst": 6300.00, "total_amount": 4900.00}, # Math mismatch: 35k + 6.3k tax != 4.9k

    # 12. Rao Printers — Low OCR / missing field
    {"filename": "INV-1201.pdf", "invoice_number": "INV-1201", "vendor_name": "Rao Printers", "vendor_gstin": VALID_GSTIN_MAP["Rao Printers"], "invoice_date": "18-07-2026", "taxable_value": 5500.00, "cgst": 0.0, "sgst": 0.0, "igst": 990.00, "total_amount": 6490.00, "blurry": True},

    # 13. Vendor Anomaly / Typo-Squatting / Phantom Vendor
    {"filename": "INV-1301.pdf", "invoice_number": "INV-1301", "vendor_name": "Sharma Tracers", "vendor_gstin": VALID_GSTIN_MAP["Sharma Traders"], "invoice_date": "19-07-2026", "taxable_value": 12000.00, "cgst": 1080.00, "sgst": 1080.00, "igst": 0.0, "total_amount": 14160.00}, # Typo-squatting
    {"filename": "INV-1302.pdf", "invoice_number": "INV-1302", "vendor_name": "Zeta Global Corp", "vendor_gstin": "99AAACZ9999Z1Z9", "invoice_date": "16-07-2026", "taxable_value": 50000.00, "cgst": 0.0, "sgst": 0.0, "igst": 9000.00, "total_amount": 59000.00}, # Phantom vendor

    # 14. Multi-Signal High Risk Invoice
    {"filename": "INV-9999_MULTI.pdf", "invoice_number": "INV-9999", "vendor_name": "Apex Cybertech", "vendor_gstin": "99BADGSTIN9999Z9", "invoice_date": "15-07-2026", "taxable_value": 90000.00, "cgst": 0.0, "sgst": 0.0, "igst": 16200.00, "total_amount": 106200.00, "tamper_metadata": True},
]

# Generate additional clean invoices (INV-2001 to INV-2035) with valid GSTINs and correct state tax rules
CLEAN_VENDORS = list(VALID_GSTIN_MAP.items())

start_id = 2001
for i in range(35):
    inv_num = f"INV-{start_id + i}"
    v_name, v_gstin = CLEAN_VENDORS[i % len(CLEAN_VENDORS)]
    taxable = float(10000 + (i * 1250) % 45000)
    is_intra = v_gstin[:2] == HOME_STATE
    if is_intra:
        cgst = round(taxable * 0.09, 2)
        sgst = round(taxable * 0.09, 2)
        igst = 0.0
    else:
        cgst = 0.0
        sgst = 0.0
        igst = round(taxable * 0.18, 2)
    total = round(taxable + cgst + sgst + igst, 2)
    day = (i % 25) + 1
    dt_str = f"{day:02d}-07-2026"
    DEMO_INVOICES.append({
        "filename": f"{inv_num}.pdf",
        "invoice_number": inv_num,
        "vendor_name": v_name,
        "vendor_gstin": v_gstin,
        "invoice_date": dt_str,
        "taxable_value": taxable,
        "cgst": cgst,
        "sgst": sgst,
        "igst": igst,
        "total_amount": total,
    })


def create_invoice_pdf(data: dict) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Vendor Name as First Line (Line 0 for OCR parser)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, str(data["vendor_name"]))

    c.setFont("Helvetica", 10)
    c.drawString(50, 730, f"GSTIN: {data['vendor_gstin']}")
    c.drawString(50, 715, "123 Commercial Complex, Industrial Estate, City")
    
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.line(50, 700, 550, 700)

    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 675, "TAX INVOICE")

    c.setFont("Helvetica", 10)
    c.drawString(50, 650, f"Invoice No: {data['invoice_number']}")
    c.drawString(50, 635, f"Invoice Date: {data['invoice_date']}")
    c.drawString(50, 620, "Payment Terms: Net 45 Days")

    # Amounts Table
    y = 570
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Description")
    c.drawString(350, y, "Amount (INR)")
    c.line(50, y - 5, 550, y - 5)

    y -= 25
    c.setFont("Helvetica", 10)
    c.drawString(50, y, "Goods / Professional Services Rendered")
    c.drawString(350, y, f"{data['taxable_value']:.2f}")

    y -= 30
    c.drawString(50, y, f"Taxable Value: {data['taxable_value']:.2f}")
    y -= 15
    if data.get("igst", 0) > 0:
        c.drawString(50, y, f"IGST: {data['igst']:.2f}")
    else:
        c.drawString(50, y, f"CGST: {data['cgst']:.2f}")
        y -= 15
        c.drawString(50, y, f"SGST: {data['sgst']:.2f}")

    y -= 25
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, f"Total Amount: {data['total_amount']:.2f}")

    c.save()
    pdf_bytes = buffer.getvalue()

    if data.get("tamper_metadata"):
        pdf = pikepdf.open(io.BytesIO(pdf_bytes))
        pdf.docinfo["/Producer"] = "Canva PDF Exporter 2.0"
        pdf.docinfo["/Creator"] = "Adobe Photoshop 2024"
        out_buf = io.BytesIO()
        pdf.save(out_buf)
        pdf_bytes = out_buf.getvalue()

    return pdf_bytes


def generate_invoices():
    os.makedirs(INVOICES_DIR, exist_ok=True)
    generated = 0
    for inv in DEMO_INVOICES:
        path = os.path.join(INVOICES_DIR, inv["filename"])
        pdf_bytes = create_invoice_pdf(inv)
        with open(path, "wb") as f:
            f.write(pdf_bytes)
        generated += 1

    print(f"Generated {generated} invoice PDFs -> {INVOICES_DIR}")
    return DEMO_INVOICES


if __name__ == "__main__":
    generate_invoices()
