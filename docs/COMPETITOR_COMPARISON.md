# Competitor Comparison

No named competitors — we don't have verified information about any specific
product's internals, so this compares categories of approach, not brands.

| Feature | Manual Review | OCR-only System | Generic AI Chat Tool | Invoice Risk Scanner |
|---|---|---|---|---|
| Field extraction | Human reads | Yes | Yes (if given the document) | Yes — OCR + regex, AI fallback on low-confidence fields |
| GSTIN validation | Manual, error-prone | Typically no | No, unless explicitly asked and still not verifiable | Yes — structural regex + real mod-36 checksum |
| Duplicate detection | Manual, samples only | Typically no | No structural mechanism | Yes — exact hash + scoped fuzzy matching |
| Vendor-master matching (phantom/typo-squat) | Manual, samples only | No | No | Yes — exact + fuzzy match against vendor master, live per invoice |
| Ledger reconciliation | Manual | No | No | Yes — live per invoice against ledger CSV/DB |
| Vendor behavior analysis | No | No | No | Yes — z-score anomaly, sequence-gap, Benford's Law, run on demand at the portfolio level |
| Auto-classification / folder sorting | Manual | No | No | Yes — cache-based, live per invoice |
| Risk scoring | Subjective | N/A | N/A, unless prompted, and then unexplainable | Weighted, fully traceable 0–100 score |
| Evidence chain | Paper trail, inconsistent | None | None | Every risk point names its source check |
| AI explanation | N/A | N/A | Yes, but ungrounded | Yes, grounded in already-computed findings |
| Human review workflow | 100% manual | N/A | N/A | Ticket system, mandatory resolution reason, role-gated write access |
| Audit trail | Inconsistent | None | None | Append-only history log + SHA-256 invoice seal |
| Financial exposure metrics | Manual estimate | No | No | Yes — ITC-at-risk and MSME-penalty totals, computed at the portfolio-report level |

**Avoid saying**: "No other product can do this." We haven't audited every
competing product's internals, and some of the underlying techniques (OCR,
fuzzy matching, checksum validation) are individually well known. The honest
differentiator is the specific combination and the deterministic-then-AI
architecture, not any single algorithm in isolation.

**Also avoid overclaiming freshness**: vendor behavior analysis and the
financial exposure metrics are now real and wired — but only at the
portfolio-report level, not on a single freshly uploaded invoice. Say that
distinction out loud rather than letting "yes" imply it happens everywhere.
