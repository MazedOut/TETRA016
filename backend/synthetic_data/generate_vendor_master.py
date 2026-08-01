"""Generates the vendor master CSV, including at least one vendor deliberately left out
(to trigger phantom-vendor detection) and one near-duplicate vendor name (to trigger
typo-squatting detection)."""


def generate_vendor_master():
    raise NotImplementedError("Build alongside generate_invoices.py and generate_ledger.py.")


if __name__ == "__main__":
    generate_vendor_master()
