"""Generates plain-language exception explanations for flagged invoices,
batched by pattern. Structured JSON output only.

Pipeline stage: Stage 6 - AI layer
"""
from google import genai
from google.genai import types
import json
from app.config import GEMINI_API_KEY

_client = genai.Client(api_key=GEMINI_API_KEY)

def generate_narratives(scoring_result: dict) -> dict:
    """Takes risk_scorer.score_invoice() output, returns the same dict with
    a 'narrative' string added to each contributing_checks entry."""
    checks = scoring_result.get("contributing_checks", [])
    if not checks:
        return {**scoring_result, "summary": "No risk flags — invoice looks clean."}

    prompt = (
        "You are an audit assistant. For each of these flagged issues on an "
        "invoice, write ONE short plain-language sentence (under 20 words) "
        "explaining what it means for a non-technical MSME owner or auditor. "
        "Respond with ONLY a JSON array of strings, same order, no markdown.\n\n"
        + json.dumps([{"check": c["check"], "reason": c["reason"]} for c in checks])
    )

    try:
        resp = _client.models.generate_content(
            model="gemini-flash-latest",
            contents=[prompt],
        )
        text = resp.text.strip().removeprefix("```json").removesuffix("```").strip()
        narratives = json.loads(text)
    except Exception:
        narratives = [c["reason"] or c["check"] for c in checks]  # fallback: raw reason/check name

    for i, c in enumerate(checks):
        c["narrative"] = narratives[i] if i < len(narratives) else c["reason"]

    top_issue = checks[0]["narrative"]
    summary = f"Flagged {scoring_result['risk_level']} risk ({scoring_result['risk_score']}/100): {top_issue}"

    return {**scoring_result, "contributing_checks": checks, "summary": summary}