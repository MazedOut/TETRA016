"""
Generates 15-20 realistic PDF invoices using ReportLab, with intentional
anomalies deliberately planted for demo purposes:
  - a handful of exact + near-duplicate invoices ("INV-2214" vs "INV-22l4")
  - a few invalid/malformed GSTINs
  - a sequence gap within one vendor's invoice numbering
  - a couple of amount/date mismatches vs the ledger
  - at least one vendor with a Photoshop/Canva PDF metadata signature
  - one vendor with enough invoices to test Benford's Law deviation
  - one or two invoices unpaid/overdue past 45 days (MSME 43B(h) case)
Output lands in backend/synthetic_data/output/.
"""


def generate_invoices():
    raise NotImplementedError("Build with reportlab. Do this early - hour 0-2 dependency for everything else.")


if __name__ == "__main__":
    generate_invoices()
