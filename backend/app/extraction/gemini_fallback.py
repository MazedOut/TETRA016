"""Gemini vision call for low-confidence or messy-layout fields only."""
from google import genai
from google.genai import types
import json
import re
import time
from app.config import GEMINI_API_KEY

_client = genai.Client(api_key=GEMINI_API_KEY)
_NUMERIC_FIELDS = {"total_amount", "taxable_value", "cgst", "sgst", "igst"}

def fix_fields(image_bytes: bytes, mime_type: str, missing_fields: list[str], retries: int = 3) -> dict:
    prompt = (
        f"Extract these fields from this invoice image: {missing_fields}. "
        "Respond with ONLY a JSON object, no markdown, no explanation. "
        "For numeric fields, return plain numbers with no commas or currency symbols. "
        "Use null for any field you cannot find."
    )
    for attempt in range(retries):
        try:
            resp = _client.models.generate_content(
                model="gemini-flash-latest",
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    prompt,
                ],
            )
            text = resp.text.strip().removeprefix("```json").removesuffix("```").strip()
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return {f: None for f in missing_fields}
            for k, v in parsed.items():
                if k in _NUMERIC_FIELDS and isinstance(v, str):
                    parsed[k] = re.sub(r"[,\u20b9]", "", v).strip()
            return parsed
        except Exception:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    return {f: None for f in missing_fields}