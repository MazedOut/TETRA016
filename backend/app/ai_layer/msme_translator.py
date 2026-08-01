"""Translates auditor-facing findings into MSME-friendly plain language
for the MSME dashboard mode.

Pipeline stage: Stage 6 - AI layer
"""
import json
import logging
import concurrent.futures
from app.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)
AI_TIMEOUT_SECONDS = 30

_client = None

def _get_client():
    global _client
    if _client is None:
        try:
            from google import genai
            _client = genai.Client(api_key=GEMINI_API_KEY)
        except Exception as exc:
            logger.warning("msme_translator: Gemini client init failed: %s", exc)
    return _client


def translate_for_msme(scoring_result: dict) -> dict:
    """Takes a scoring result (ideally already run through generate_narratives)
    and rewrites each narrative in simpler, action-oriented language for a
    small business owner rather than an auditor.
    Degrades gracefully on API failure/timeout — falls back to auditor narrative."""
    checks = scoring_result.get("contributing_checks", [])
    if not checks:
        return {**scoring_result, "msme_summary": "This invoice looks fine — no action needed."}

    prompt = (
        "You are helping a small business owner (not an accountant) understand "
        "potential issues found in one of their supplier invoices. For each item below, "
        "write ONE short, simple sentence (under 20 words) telling them what "
        "may need attention and what to do next (e.g. 'ask your supplier for X', "
        "'double check with your accountant'). Avoid audit jargon. "
        "Use 'may', 'appears to', 'requires review' — never say 'fraud' or assert certainty. "
        "Respond with ONLY a JSON array of strings, same order, no markdown.\n\n"
        + json.dumps([{"check": c["check"], "reason": c.get("narrative", c["reason"])} for c in checks])
    )

    simplified = None
    client = _get_client()
    if client:
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                future = ex.submit(
                    client.models.generate_content,
                    model="gemini-2.0-flash",
                    contents=[prompt],
                )
                try:
                    resp = future.result(timeout=AI_TIMEOUT_SECONDS)
                    text = resp.text.strip().removeprefix("```json").removesuffix("```").strip()
                    simplified = json.loads(text)
                except concurrent.futures.TimeoutError:
                    logger.warning("msme_translator: Gemini call timed out after %ds", AI_TIMEOUT_SECONDS)
        except Exception as exc:
            logger.warning("msme_translator: Gemini call failed: %s", exc)

    if simplified is None:
        simplified = [c.get("narrative", c["reason"]) for c in checks]

    for i, c in enumerate(checks):
        c["msme_narrative"] = simplified[i] if i < len(simplified) else c.get("narrative", c["reason"])

    level_word = {"high": "serious", "medium": "worth checking", "low": "minor"}.get(
        scoring_result["risk_level"], "flagged"
    )
    msme_summary = f"This invoice may have a {level_word} issue requiring attention: {checks[0]['msme_narrative']}"

    return {**scoring_result, "contributing_checks": checks, "msme_summary": msme_summary}