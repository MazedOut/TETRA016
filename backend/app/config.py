"""
Central config: API keys, DB URL, scoring weights, thresholds.
Loads from environment variables (.env) via python-dotenv.
"""
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./invoice_risk.db")

# --- Risk scoring weights (tune during build) ---
RISK_WEIGHTS = {
    "duplicate_invoice": 40,
    "invalid_gstin": 30,
    "amount_mismatch": 40,
    "date_mismatch": 15,
    "phantom_vendor": 35,
    "typo_squatting_vendor": 25,
    "missing_ledger_entry": 30,
    "sequence_gap": 20,
    "internal_math_error": 25,
    "tax_type_misclassification": 20,
    "pdf_metadata_tamper": 30,
    "invisible_text_detected": 35,
    "benford_deviation": 20,
    "vendor_activity_anomaly": 15,
}

RISK_THRESHOLDS = {
    "high": 50,
    "medium": 20,
}

# --- Field-criticality tiering ---
CRITICAL_FIELDS = ["invoice_number", "vendor_name", "total_amount"]
SOFT_FIELDS = ["po_number", "line_items"]

# --- MSME 43B(h) rule ---
MSME_PAYMENT_DEADLINE_DAYS = 45
MSME_DISALLOWED_TAX_RATE = 0.30

CONFIDENCE_LOW_THRESHOLD = 0.80

# --- Buyer (our company) identity, for inter/intra-state GST check ---
BUYER_GSTIN = "24AABCU9876Q1Z8"  # Gujarat (state code 24) — adjust if your synthetic data uses a different home state

# --- GSTIN Registry API keys (Tier 3 live verification) ---
GSTINCHECK_API_KEY = os.getenv("GSTINCHECK_API_KEY", "")
APPYFLOW_KEY_SECRET = os.getenv("APPYFLOW_KEY_SECRET", "")
GSTIN_REGISTRY_MAX_CALLS = int(os.getenv("GSTIN_REGISTRY_MAX_CALLS", "50"))
GSTIN_REGISTRY_TIMEOUT = int(os.getenv("GSTIN_REGISTRY_TIMEOUT", "10"))
GSTIN_NAME_MATCH_THRESHOLD = int(os.getenv("GSTIN_NAME_MATCH_THRESHOLD", "70"))
