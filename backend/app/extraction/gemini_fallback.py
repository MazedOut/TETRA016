"""Gemini vision call for low-confidence or messy-layout fields only.
Uses a 30-second timeout per attempt and degrades gracefully on any failure.
"""
import json
import re
import time
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
            logger.warning("gemini_fallback: client init failed: %s", exc)
    return _client


_NUMERIC_FIELDS = {"total_amount", "taxable_value", "cgst", "sgst", "igst"}


def fix_fields(image_bytes: bytes, mime_type: str, missing_fields: list, retries: int = 2) -> dict:
    """Calls Gemini Vision to extract missing fields from a low-quality invoice scan.
    Returns {field: value} dict; missing fields are None. Never raises.
    """
    prompt = (
        f"Extract these fields from this invoice image: {missing_fields}. "
        "Respond with ONLY a JSON object, no markdown, no explanation. "
        "For numeric fields, return plain numbers with no commas or currency symbols. "
        "Use null for any field you cannot find."
    )

    client = _get_client()
    if client is None:
        return {f: None for f in missing_fields}

    for attempt in range(retries):
        try:
            from google.genai import types

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                future = ex.submit(
                    client.models.generate_content,
                    model="gemini-2.0-flash",
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        prompt,
                    ],
                )
                try:
                    resp = future.result(timeout=AI_TIMEOUT_SECONDS)
                except concurrent.futures.TimeoutError:
                    logger.warning("gemini_fallback: timed out on attempt %d", attempt + 1)
                    if attempt < retries - 1:
                        time.sleep(2 ** attempt)
                    continue

            text = resp.text.strip().removeprefix("```json").removesuffix("```").strip()
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return {f: None for f in missing_fields}
            for k, v in parsed.items():
                if k in _NUMERIC_FIELDS and isinstance(v, str):
                    parsed[k] = re.sub(r"[,\u20b9]", "", v).strip()
            return parsed

        except Exception as exc:
            logger.warning("gemini_fallback: attempt %d failed: %s", attempt + 1, exc)
            if attempt < retries - 1:
                time.sleep(2 ** attempt)

    return {f: None for f in missing_fields}