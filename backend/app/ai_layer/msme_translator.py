"""Translates auditor-facing findings into MSME-friendly plain language
for the MSME dashboard mode.

Pipeline stage: Stage 6 - AI layer
"""
from google import genai
import json
from app.config import GEMINI_API_KEY

_client = genai.Client(api_key=GEMINI_API_KEY)

def translate_for_msme(scoring_result: dict) -> dict:
    """Takes a scoring result (ideally already run through generate_narratives)
    and rewrites each narrative in simpler, action-oriented language for a
    small business owner rather than an auditor."""
    checks = scoring_result.get("contributing_checks", [])
    if not checks:
        return {**scoring_result, "msme_summary": "This invoice looks fine — no action needed."}

    prompt = (
        "You are helping a small business owner (not an accountant) understand "
        "problems found in one of their supplier invoices. For each issue below, "
        "write ONE short, simple sentence (under 20 words) telling them what "
        "happened and what to do next (e.g. 'ask your supplier for X', "
        "'double check with your accountant'). Avoid audit jargon. "
        "Respond with ONLY a JSON array of strings, same order, no markdown.\n\n"
        + json.dumps([{"check": c["check"], "reason": c.get("narrative", c["reason"])} for c in checks])
    )

    try:
        resp = _client.models.generate_content(model="gemini-flash-latest", contents=[prompt])
        text = resp.text.strip().removeprefix("```json").removesuffix("```").strip()
        simplified = json.loads(text)
    except Exception:
        simplified = [c.get("narrative", c["reason"]) for c in checks]

    for i, c in enumerate(checks):
        c["msme_narrative"] = simplified[i] if i < len(simplified) else c.get("narrative", c["reason"])

    level_word = {"high": "serious", "medium": "worth checking", "low": "minor"}.get(scoring_result["risk_level"], "")
    msme_summary = f"This invoice has a {level_word} issue: {checks[0]['msme_narrative']}"

    return {**scoring_result, "contributing_checks": checks, "msme_summary": msme_summary}