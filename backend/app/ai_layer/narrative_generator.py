"""Generates plain-language exception explanations for flagged invoices,
batched by pattern. Structured JSON output only.

Pipeline stage: Stage 6 - AI layer
"""
import json
import logging
from app.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

# Lazy-init Gemini client so startup doesn't fail when API key is absent
_client = None

def _get_client():
    global _client
    if _client is None:
        try:
            from google import genai
            _client = genai.Client(api_key=GEMINI_API_KEY)
        except Exception as exc:
            logger.warning("narrative_generator: Gemini client init failed: %s", exc)
    return _client


AI_TIMEOUT_SECONDS = 30


def generate_narratives(scoring_result: dict) -> dict:
    """Takes risk_scorer.score_invoice() output, returns the same dict with
    a 'narrative' string added to each contributing_checks entry.
    Degrades gracefully on API failure/timeout — uses raw reason as fallback."""
    checks = scoring_result.get("contributing_checks", [])
    if not checks:
        return {**scoring_result, "summary": "No risk flags — invoice passed all automated checks."}

    prompt = (
        "You are an audit assistant. For each of these flagged anomalies on an "
        "invoice, write ONE short plain-language sentence (under 20 words) "
        "explaining what it means for an auditor. "
        "Use language like 'requires review', 'anomaly detected', 'potential duplicate' — "
        "never assert fraud or certainty. "
        "Respond with ONLY a JSON array of strings, same order, no markdown.\n\n"
        + json.dumps([{"check": c["check"], "reason": c["reason"]} for c in checks])
    )

    narratives = None
    client = _get_client()
    if client:
        try:
            import signal
            def _timeout_handler(signum, frame):
                raise TimeoutError("Gemini narrative_generator timeout")

            # Use threading timeout for Windows compatibility
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                future = ex.submit(
                    client.models.generate_content,
                    model="gemini-2.0-flash",
                    contents=[prompt],
                )
                try:
                    resp = future.result(timeout=AI_TIMEOUT_SECONDS)
                    text = resp.text.strip().removeprefix("```json").removesuffix("```").strip()
                    narratives = json.loads(text)
                except concurrent.futures.TimeoutError:
                    logger.warning("narrative_generator: Gemini call timed out after %ds", AI_TIMEOUT_SECONDS)
        except Exception as exc:
            logger.warning("narrative_generator: Gemini call failed: %s", exc)

    if narratives is None:
        narratives = [c["reason"] or c["check"] for c in checks]

    for i, c in enumerate(checks):
        c["narrative"] = narratives[i] if i < len(narratives) else c["reason"]

    top_issue = checks[0]["narrative"]
    summary = f"Flagged {scoring_result['risk_level']} risk ({scoring_result['risk_score']}/100): {top_issue}"

    return {**scoring_result, "contributing_checks": checks, "summary": summary}