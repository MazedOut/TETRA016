"""
Tier 3: Live GSTIN registry cross-check via external APIs.

Called ONLY when a GSTIN passes Tier 1 structural validation and misses
the Tier 2 vendor cache. Preserves cost-efficiency by:
  - Caching every result permanently (keyed by GSTIN)
  - Circuit breaker to avoid exceeding free-tier quotas
  - Dual-provider fallback (gstincheck -> appyflow)

Pipeline stage: Stage 4 - Reconciliation (Tier 3)
"""
import os
import json
import logging
import urllib.request
import urllib.error
from rapidfuzz import fuzz

from app.config import (
    GSTINCHECK_API_KEY,
    APPYFLOW_KEY_SECRET,
    GSTIN_REGISTRY_MAX_CALLS,
    GSTIN_REGISTRY_TIMEOUT,
    GSTIN_NAME_MATCH_THRESHOLD,
)

logger = logging.getLogger(__name__)

# ── Session-level circuit breaker ─────────────────────────────────────────────
_session_call_count = 0


# ── GSTIN Registry Cache (JSON-file-backed, keyed by GSTIN) ──────────────────
CACHE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "synthetic_data", "output", "gstin_registry_cache.json"
)


class GstinRegistryCache:
    """Permanent GSTIN -> registry result cache, backed by a JSON file.
    Separate from VendorCache (which is keyed by vendor name for classification)."""

    def __init__(self, cache_path: str = CACHE_PATH):
        self.cache_path = cache_path
        self._cache: dict[str, dict] = {}
        self._load()

    def _load(self):
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, "r") as f:
                    self._cache = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._cache = {}

    def _save(self):
        os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
        with open(self.cache_path, "w") as f:
            json.dump(self._cache, f, indent=2)

    def get(self, gstin: str) -> dict | None:
        return self._cache.get(gstin)

    def set(self, gstin: str, result: dict):
        self._cache[gstin] = result
        self._save()


_cache = GstinRegistryCache()


# ── Provider API calls ────────────────────────────────────────────────────────

def _call_gstincheck(gstin: str) -> dict | None:
    """Primary provider: gstincheck.co.in free-tier API."""
    if not GSTINCHECK_API_KEY:
        logger.warning("GSTINCHECK_API_KEY not configured, skipping primary provider.")
        return None

    url = f"https://sheet.gstincheck.co.in/check/{GSTINCHECK_API_KEY}/{gstin}"
    try:
        req = urllib.request.Request(url, method="GET")
        req.add_header("User-Agent", "IRS-InvoiceRiskScanner/1.0")
        with urllib.request.urlopen(req, timeout=GSTIN_REGISTRY_TIMEOUT) as resp:
            data = json.loads(resp.read().decode())

        if not data or data.get("flag") is False:
            logger.warning(f"gstincheck returned no data for {gstin}: {data}")
            return None

        return _normalize_response(data, "gstincheck")
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError, OSError) as e:
        logger.warning(f"gstincheck call failed for {gstin}: {e}")
        return None


def _call_appyflow(gstin: str) -> dict | None:
    """Backup provider: AppyFlow GST verification API."""
    if not APPYFLOW_KEY_SECRET:
        logger.warning("APPYFLOW_KEY_SECRET not configured, skipping backup provider.")
        return None

    url = f"https://appyflow.in/api/verifyGST?gstNo={gstin}&key_secret={APPYFLOW_KEY_SECRET}"
    try:
        req = urllib.request.Request(url, method="GET")
        req.add_header("User-Agent", "IRS-InvoiceRiskScanner/1.0")
        with urllib.request.urlopen(req, timeout=GSTIN_REGISTRY_TIMEOUT) as resp:
            data = json.loads(resp.read().decode())

        if not data or data.get("error"):
            logger.warning(f"appyflow returned no data for {gstin}: {data}")
            return None

        return _normalize_response(data, "appyflow")
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError, OSError) as e:
        logger.warning(f"appyflow call failed for {gstin}: {e}")
        return None


# ── Response normalization ────────────────────────────────────────────────────

def _normalize_response(raw: dict, provider: str) -> dict:
    """Maps provider-specific JSON into a consistent internal schema."""
    if provider == "gstincheck":
        data = raw.get("data", raw)
        gst_status = data.get("sts", data.get("dty", "Unknown"))
        legal_name = data.get("lgnm", "")
        trade_name = data.get("tradeNam", "")
        address_parts = data.get("pradr", {}).get("adr", "")
        address = address_parts if isinstance(address_parts, str) else str(address_parts)
    elif provider == "appyflow":
        gst_status = raw.get("taxpayerInfo", {}).get("sts", raw.get("sts", "Unknown"))
        taxpayer = raw.get("taxpayerInfo", raw)
        legal_name = taxpayer.get("lgnm", "")
        trade_name = taxpayer.get("tradeNam", "")
        address = taxpayer.get("pradr", {}).get("adr", "") if isinstance(taxpayer.get("pradr"), dict) else ""
    else:
        return {"registry_status": "unchecked", "reason": f"Unknown provider: {provider}"}

    # Map GST status string to our internal registry_status
    status_upper = str(gst_status).strip().upper()
    if status_upper in ("ACTIVE", "ACT"):
        registry_status = "verified"
        gst_status_clean = "Active"
    elif status_upper in ("CANCELLED", "CNL", "CAN"):
        registry_status = "cancelled"
        gst_status_clean = "Cancelled"
    elif status_upper in ("SUSPENDED", "SUS"):
        registry_status = "cancelled"
        gst_status_clean = "Suspended"
    else:
        registry_status = "unchecked"
        gst_status_clean = str(gst_status)

    return {
        "registry_status": registry_status,
        "legal_name": legal_name,
        "trade_name": trade_name,
        "gst_status": gst_status_clean,
        "address": address,
        "source_provider": provider,
    }


# ── Fuzzy name matching ───────────────────────────────────────────────────────

def _fuzzy_name_match(invoice_vendor_name: str, result: dict) -> dict:
    """Compares the invoice's printed vendor name against registry legal_name
    and trade_name. If similarity is below threshold, flags as 'mismatch'
    (phantom-vendor / fake-GSTIN-reuse signal)."""
    if not invoice_vendor_name:
        return result

    legal_name = result.get("legal_name", "")
    trade_name = result.get("trade_name", "")

    best_score = 0
    if legal_name:
        best_score = max(best_score, fuzz.token_sort_ratio(invoice_vendor_name.upper(), legal_name.upper()))
    if trade_name:
        best_score = max(best_score, fuzz.token_sort_ratio(invoice_vendor_name.upper(), trade_name.upper()))

    result["name_match_score"] = round(best_score, 1)

    if best_score < GSTIN_NAME_MATCH_THRESHOLD and result.get("registry_status") == "verified":
        result["registry_status"] = "mismatch"
        result["mismatch_reason"] = (
            f"Invoice vendor name '{invoice_vendor_name}' does not match "
            f"registry legal name '{legal_name}' or trade name '{trade_name}' "
            f"(best similarity: {best_score}%)"
        )

    return result


# ── Main public function ──────────────────────────────────────────────────────

def verify_gstin_registry(gstin: str, invoice_vendor_name: str = None) -> dict:
    """Tier 3 GSTIN registry verification.

    Checks cache first, then calls gstincheck (primary) -> appyflow (backup).
    Gracefully degrades on failure. Never crashes the pipeline.

    Args:
        gstin: The 15-character GSTIN to verify.
        invoice_vendor_name: Optional vendor name from the invoice for
            fuzzy name matching against registry data.

    Returns:
        dict with registry_status, legal_name, trade_name, gst_status,
        address, source_provider, and optionally name_match_score.
    """
    global _session_call_count

    if not gstin or not isinstance(gstin, str) or len(gstin) != 15:
        return {"registry_status": "unchecked", "reason": "Invalid GSTIN format"}

    gstin = gstin.strip().upper()

    # 1. Check cache
    cached = _cache.get(gstin)
    if cached:
        result = {**cached, "source_provider": "cache"}
        if invoice_vendor_name:
            result = _fuzzy_name_match(invoice_vendor_name, result)
        return result

    # 2. Check circuit breaker
    if _session_call_count >= GSTIN_REGISTRY_MAX_CALLS:
        logger.warning(f"GSTIN registry circuit breaker hit ({_session_call_count}/{GSTIN_REGISTRY_MAX_CALLS}). Skipping live lookup for {gstin}.")
        return {
            "registry_status": "unchecked",
            "reason": f"Session quota limit reached ({GSTIN_REGISTRY_MAX_CALLS} calls)",
        }

    # 3. Try primary provider (gstincheck)
    _session_call_count += 1
    result = _call_gstincheck(gstin)

    # 4. Fallback to backup provider (appyflow)
    if result is None:
        _session_call_count += 1
        result = _call_appyflow(gstin)

    # 5. Both failed — graceful degradation
    if result is None:
        return {
            "registry_status": "unchecked",
            "reason": "Both registry providers failed (network/quota error)",
        }

    # 6. Cache the successful result
    _cache.set(gstin, result)

    # 7. Fuzzy name match
    if invoice_vendor_name:
        result = _fuzzy_name_match(invoice_vendor_name, result)

    return result
