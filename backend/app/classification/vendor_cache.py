"""
Cached vendor -> category map, avoids repeat AI calls.

Pipeline stage: Stage 3 - Classification
Status: stub — not yet implemented.
"""


def not_implemented():
    raise NotImplementedError("backend/app/classification/vendor_cache.py is a scaffold stub. Implement this module.")

"""
Cached vendor -> category map, avoids repeat AI calls.

Pipeline stage: Stage 3 - Classification
"""
import pandas as pd
import os

CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "synthetic_data", "output", "vendor_cache.csv")


class VendorCache:
    """In-memory vendor -> category cache, backed by a CSV file so it persists
    across restarts. Seeded from vendor_master.csv on first load."""

    def __init__(self, cache_path: str = CACHE_PATH, seed_path: str | None = None):
        self.cache_path = cache_path
        self._cache: dict[str, str] = {}
        self._load(seed_path)

    def _load(self, seed_path: str | None):
        if os.path.exists(self.cache_path):
            df = pd.read_csv(self.cache_path)
            self._cache = dict(zip(df["vendor_name"], df["category"]))
        elif seed_path and os.path.exists(seed_path):
            # First run: seed from vendor master's existing category column
            df = pd.read_csv(seed_path)
            self._cache = dict(zip(df["vendor_name"], df["category"]))
            self._save()

    def _save(self):
        os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
        df = pd.DataFrame(list(self._cache.items()), columns=["vendor_name", "category"])
        df.to_csv(self.cache_path, index=False)

    def get(self, vendor_name: str) -> str | None:
        """Returns the cached category for a vendor, or None if not yet classified."""
        return self._cache.get(vendor_name)

    def set(self, vendor_name: str, category: str):
        """Stores a new classification (e.g. from vendor_classifier.py after an AI
        or manual call) so future lookups for this vendor are free."""
        self._cache[vendor_name] = category
        self._save()

    def is_known(self, vendor_name: str) -> bool:
        return vendor_name in self._cache