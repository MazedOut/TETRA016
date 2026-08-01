"""Temporary mock 'extracted invoice' records for testing reconciliation modules
before Role 1's extraction pipeline is wired up. Shape mirrors what extraction
will eventually hand off: one dict per invoice."""
from datetime import datetime

MOCK_INVOICES = [
    {"invoice_number": "INV-101", "vendor_name": "Sharma Traders", "vendor_gstin": "24AAACS1234F1ZY",
     "invoice_date": datetime(2026, 7, 22), "total_amount": 11800.00},

    # Exact duplicate of INV-101 above — same everything, re-submitted
    {"invoice_number": "INV-101", "vendor_name": "Sharma Traders", "vendor_gstin": "24AAACS1234F1ZY",
     "invoice_date": datetime(2026, 7, 22), "total_amount": 11800.00},

    {"invoice_number": "INV-2214", "vendor_name": "Bansal Electricals", "vendor_gstin": "27AACCB5678K1Z8",
     "invoice_date": datetime(2026, 7, 17), "total_amount": 47200.00},

    # Near-duplicate: "l" instead of "1" in the invoice number, same vendor, same amount
    {"invoice_number": "INV-22l4", "vendor_name": "Bansal Electricals", "vendor_gstin": "27AACCB5678K1Z8",
     "invoice_date": datetime(2026, 7, 17), "total_amount": 47200.00},

    # Clean, unrelated invoice — should NOT be flagged
    {"invoice_number": "INV-301", "vendor_name": "Patel Logistics", "vendor_gstin": "24AABCP4321L1ZL",
     "invoice_date": datetime(2026, 7, 27), "total_amount": 8260.00},

     # Typo-squat: close to "Sharma Traders" but NOT in vendor master, different GSTIN
    {"invoice_number": "INV-2001", "vendor_name": "Sharrma Traders", "vendor_gstin": "24AAACX9999X1Z1",
     "invoice_date": datetime(2026, 7, 20), "total_amount": 15000.00},

    # Phantom vendor: no close match to anything in vendor master at all
    {"invoice_number": "INV-2002", "vendor_name": "Om Enterprises", "vendor_gstin": "19AAACY8888Y1Z2",
     "invoice_date": datetime(2026, 7, 21), "total_amount": 9500.00},

     # Missing from ledger entirely
    {"invoice_number": "INV-1301", "vendor_name": "Nair Textiles", "vendor_gstin": "32AABCN2233N1ZN",
     "invoice_date": datetime(2026, 7, 19), "total_amount": 9990.00},
    {"invoice_number": "INV-1302", "vendor_name": "Gupta Packaging", "vendor_gstin": "07AAACG3344P1ZE",
     "invoice_date": datetime(2026, 7, 16), "total_amount": 13500.00},

    # Amount mismatch vs ledger (ledger posted 22500, invoice says 22000)
    {"invoice_number": "INV-1401", "vendor_name": "Reddy Chemicals", "vendor_gstin": "36AABCR5566Q1ZN",
     "invoice_date": datetime(2026, 7, 15), "total_amount": 22000.00},

    # Amount mismatch vs ledger (ledger posted 14800, invoice says 16000)
    {"invoice_number": "INV-1402", "vendor_name": "Verma Hardware", "vendor_gstin": "09AABCV7788R1Z2",
     "invoice_date": datetime(2026, 7, 14), "total_amount": 16000.00},

    # Date mismatch vs ledger (posted 12 days after invoice date)
    {"invoice_number": "INV-1403", "vendor_name": "Kapoor Consultants", "vendor_gstin": "06AABCK8899S1ZB",
     "invoice_date": datetime(2026, 7, 13), "total_amount": 27750.00},

     # Completes the Sharma Traders sequence-gap test (101, 102, [103 missing], 104)
    {"invoice_number": "INV-104", "vendor_name": "Sharma Traders", "vendor_gstin": "24AAACS1234F1ZY",
     "invoice_date": datetime(2026, 7, 27), "total_amount": 9440.00},

     # Completes the Sharma Traders sequence test properly (101, 102, [103 missing], 104)
    {"invoice_number": "INV-102", "vendor_name": "Sharma Traders", "vendor_gstin": "24AAACS1234F1ZY",
     "invoice_date": datetime(2026, 7, 24), "total_amount": 23600.00},
]

# Add these to MOCK_INVOICES in _test_fixtures.py

# Typo-squat: close to "Sharma Traders" but NOT in vendor master, different GSTIN
{"invoice_number": "INV-2001", "vendor_name": "Sharrma Traders", "vendor_gstin": "24AAACX9999X1Z1",
 "invoice_date": datetime(2026, 7, 20), "total_amount": 15000.00},

# Phantom vendor: no close match to anything in vendor master at all
{"invoice_number": "INV-2002", "vendor_name": "Om Enterprises", "vendor_gstin": "19AAACY8888Y1Z2",
 "invoice_date": datetime(2026, 7, 21), "total_amount": 9500.00},