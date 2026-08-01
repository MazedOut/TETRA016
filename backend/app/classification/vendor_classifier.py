"""
First-seen vendor gets one AI or manual classification call, then cached.

Pipeline stage: Stage 3 - Classification
Status: stub — not yet implemented.
"""


def not_implemented():
    raise NotImplementedError("backend/app/classification/vendor_classifier.py is a scaffold stub. Implement this module.")

"""
First-seen vendor gets one AI or manual classification call, then cached.

Pipeline stage: Stage 3 - Classification
"""
import json
import google.generativeai as genai
from app.config import GEMINI_API_KEY
from app.classification.vendor_cache import VendorCache

genai.configure(api_key=GEMINI_API_KEY)

CATEGORY_OPTIONS = [
    "raw_materials", "electronics", "logistics", "office_supplies", "textiles",
    "packaging", "chemicals", "hardware", "services", "fabrication",
    "furniture", "printing", "consulting", "other",
]

_model = genai.GenerativeModel("gemini-2.0-flash")

CLASSIFY_PROMPT_TEMPLATE = """Classify this vendor into exactly one category from this list: {categories}

Vendor name: "{vendor_name}"

Respond with ONLY a JSON object in this exact shape, no other text:
{{"category": "<one_of_the_listed_categories>"}}
"""


def _call_ai_classifier(vendor_name: str) -> str:
    """Makes ONE Gemini call to classify a vendor by name. Returns a category
    string. Falls back to 'other' if the response is malformed or the call fails."""
    prompt = CLASSIFY_PROMPT_TEMPLATE.format(
        categories=", ".join(CATEGORY_OPTIONS),
        vendor_name=vendor_name,
    )
    try:
        response = _model.generate_content(prompt)
        text = response.text.strip()
        # Strip markdown code fences if the model wraps its JSON in them anyway
        text = text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(text)
        category = parsed.get("category", "other")
        if category not in CATEGORY_OPTIONS:
            category = "other"
        return category
    except Exception as e:
        print(f"[vendor_classifier] AI call failed for '{vendor_name}': {e}")
        return "other"


def classify_vendor(vendor_name: str, cache: VendorCache) -> str:
    """Rule -> cache -> AI, in that order:
    1. If already cached, return immediately (free).
    2. Otherwise, make ONE AI call, cache the result, then return it.
    """
    cached = cache.get(vendor_name)
    if cached is not None:
        return cached

    category = _call_ai_classifier(vendor_name)
    cache.set(vendor_name, category)
    return category