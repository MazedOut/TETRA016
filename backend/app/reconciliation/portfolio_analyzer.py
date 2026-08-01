"""
Portfolio-Level Analysis Module.
Runs portfolio-wide checks across all stored invoices:
  - vendor_anomaly.py (z-score amount anomalies & off-hours timing)
  - sequence_gap.py (invoice numbering gaps per vendor)
  - benford_check.py (Benford's Law leading digit distribution per vendor)
  - duplicate_detector.py (cross-invoice duplicate & near-duplicate clusters)
  - itc_calculator.py (input tax credit at risk)
  - msme_penalty.py (45-day MSME 43B(h) payment breach penalties)
Respects minimum sample size requirements and returns clear "Insufficient historical evidence" notes when data is below threshold.
"""
from typing import List, Dict, Any
import datetime as dt
from collections import defaultdict

from app.reconciliation.vendor_anomaly import detect_amount_anomalies, detect_off_hours_invoices, MIN_INVOICES_FOR_ANOMALY_CHECK
from app.reconciliation.sequence_gap import detect_sequence_gaps, MIN_INVOICES_FOR_SEQUENCE_CHECK
from app.reconciliation.benford_check import check_benford, MIN_INVOICES_FOR_BENFORD
from app.reconciliation.duplicate_detector import detect_duplicates
from app.scoring.itc_calculator import calculate_itc_at_risk
from app.scoring.msme_penalty import calculate_batch_penalties
from app.models.invoice import Invoice


def run_portfolio_analysis(db_invoices: List[Invoice]) -> Dict[str, Any]:
    """Runs full portfolio-level audit across all invoices in the system."""
    invoices_data = []
    for inv in db_invoices:
        invoices_data.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "vendor_name": inv.vendor_name,
            "vendor_gstin": inv.vendor_gstin,
            "invoice_date": inv.invoice_date,
            "total_amount": inv.total_amount or 0.0,
            "taxable_value": inv.taxable_value or 0.0,
            "cgst": inv.cgst or 0.0,
            "sgst": inv.sgst or 0.0,
            "igst": inv.igst or 0.0,
            "risk_score": inv.risk_score or 0.0,
            "risk_level": inv.risk_level or "low",
            "confidence_score": inv.confidence_score or 1.0,
            "ocr_source": getattr(inv, "ocr_source", "tesseract"),
            "is_paid": False, # Default unpaid for evaluation unless marked
        })

    # Group count by vendor to track sample sizes
    vendor_counts = defaultdict(int)
    for inv in invoices_data:
        v_name = inv.get("vendor_name") or "Unknown Vendor"
        vendor_counts[v_name] += 1

    sample_size_notes = []
    for v_name, count in vendor_counts.items():
        if count < MIN_INVOICES_FOR_ANOMALY_CHECK:
            sample_size_notes.append({
                "vendor_name": v_name,
                "check": "vendor_activity_anomaly",
                "status": "Insufficient historical evidence",
                "message": f"Vendor '{v_name}' has only {count} invoice(s) (minimum {MIN_INVOICES_FOR_ANOMALY_CHECK} required for statistical z-score analysis).",
            })
        if count < MIN_INVOICES_FOR_BENFORD:
            sample_size_notes.append({
                "vendor_name": v_name,
                "check": "benford_deviation",
                "status": "Insufficient historical evidence",
                "message": f"Vendor '{v_name}' has only {count} invoice(s) (minimum {MIN_INVOICES_FOR_BENFORD} required for Benford's Law chi-square test).",
            })

    # 1. Cross-invoice duplicate detection
    dup_flags = detect_duplicates(invoices_data)

    # 2. Portfolio-level vendor anomaly checks
    amount_anomaly_flags = detect_amount_anomalies(invoices_data)
    off_hours_flags = detect_off_hours_invoices(invoices_data)

    # 3. Sequence gap detection
    sequence_gap_flags = detect_sequence_gaps(invoices_data)

    # 4. Benford's law check
    benford_flags = check_benford(invoices_data)

    # 5. Financial exposure calculations
    itc_exposure = calculate_itc_at_risk(invoices_data)
    msme_exposure = calculate_batch_penalties(invoices_data)

    total_invoices = len(invoices_data)
    high_risk_count = sum(1 for inv in invoices_data if inv["risk_level"] == "high")
    review_risk_count = sum(1 for inv in invoices_data if inv["risk_level"] == "medium")
    clear_count = sum(1 for inv in invoices_data if inv["risk_level"] == "low")

    # Combine portfolio findings
    all_portfolio_flags = (
        dup_flags + amount_anomaly_flags + off_hours_flags + sequence_gap_flags + benford_flags
    )

    summary = (
        f"Portfolio Analysis completed across {total_invoices} invoices: "
        f"{high_risk_count} High Risk, {review_risk_count} Needs Review, {clear_count} Clear. "
        f"Total Input Tax Credit at risk: ₹{itc_exposure['itc_at_risk']:,.2f}. "
        f"Total 45-day MSME penalty exposure: ₹{msme_exposure['total_estimated_penalty']:,.2f}."
    )

    return {
        "summary": summary,
        "invoices_analyzed": total_invoices,
        "high_risk_count": high_risk_count,
        "review_risk_count": review_risk_count,
        "clear_count": clear_count,
        "itc_at_risk_inr": itc_exposure["itc_at_risk"],
        "msme_penalty_exposure_inr": msme_exposure["total_estimated_penalty"],
        "duplicate_clusters_count": len(dup_flags),
        "sequence_gaps_count": len(sequence_gap_flags),
        "benford_deviations_count": len(benford_flags),
        "vendor_anomalies_count": len(amount_anomaly_flags) + len(off_hours_flags),
        "portfolio_flags": all_portfolio_flags,
        "insufficient_data_notes": sample_size_notes,
    }
