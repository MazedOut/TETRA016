import axios from "axios";

// Real axios instance, proxied to the FastAPI backend via vite.config.js's
// /api proxy. Import { client } for any raw calls you need to make directly.
export const client = axios.create({
  baseURL: "/api",
});

// Set this to false once the FastAPI backend endpoints below exist.
// Every function tries the real call first when USE_MOCK is false, so this
// file is the only thing that needs to change when the backend is ready.
export const USE_MOCK = true;

function delay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Mock data — mirrors the shape the backend is expected to return.
// ---------------------------------------------------------------------------

const VENDORS = [
  "Shree Balaji Traders",
  "Om Enterprises",
  "Nova Packaging Co.",
  "Kaveri Textiles",
  "Anand Hardware",
  "Vertex Logistics",
];

const FLAG_TYPES = [
  "Duplicate invoice",
  "GSTIN checksum failed",
  "Amount / tax mismatch",
  "Sequence gap",
  "Phantom vendor",
  "Off-hours submission",
  "45-day MSME breach risk",
];

function seedTicket(i) {
  const riskScore = Math.floor(Math.random() * 100);
  const confidenceScore = Math.round((0.55 + Math.random() * 0.45) * 100);
  return {
    id: `TCK-${1000 + i}`,
    invoiceId: `INV-${2200 + i}`,
    vendor: VENDORS[i % VENDORS.length],
    flag: FLAG_TYPES[i % FLAG_TYPES.length],
    riskScore,
    confidenceScore,
    status: ["open", "in-review", "resolved", "escalated"][i % 4],
    amount: (5000 + Math.random() * 95000).toFixed(2),
    date: new Date(2026, 5, (i % 28) + 1).toISOString().slice(0, 10),
    aiNarrative:
      i % 3 === 0
        ? "Two invoices from this vendor share an identical taxable value and near-identical invoice numbers submitted 40 minutes apart — consistent with a duplicate submission rather than two genuine transactions."
        : null,
  };
}

const MOCK_TICKETS = Array.from({ length: 23 }, (_, i) => seedTicket(i));

const MOCK_STATS = {
  itcAtRiskInr: 412350,
  invoicesProcessed: 187,
  openTickets: MOCK_TICKETS.filter((t) => t.status === "open").length,
  avgConfidence: 0.91,
  msmePenaltyExposureInr: 58200,
};

const MOCK_RISK_DISTRIBUTION = [
  { bucket: "0-20", count: 88 },
  { bucket: "21-40", count: 41 },
  { bucket: "41-60", count: 29 },
  { bucket: "61-80", count: 18 },
  { bucket: "81-100", count: 11 },
];

const MOCK_FOLDERS = [
  { vendor: "Shree Balaji Traders", count: 34, category: "Raw Materials" },
  { vendor: "Om Enterprises", count: 21, category: "Packaging" },
  { vendor: "Nova Packaging Co.", count: 18, category: "Packaging" },
  { vendor: "Kaveri Textiles", count: 27, category: "Raw Materials" },
  { vendor: "Anand Hardware", count: 15, category: "Consumables" },
  { vendor: "Vertex Logistics", count: 12, category: "Services" },
];

function mockInvoiceDetail(id) {
  return {
    id,
    fileUrl: null,
    vendor: "Shree Balaji Traders",
    gstin: "24ABCDE1234F1Z5",
    invoiceDate: "2026-06-14",
    extractionConfidence: 0.87,
    fields: [
      { label: "Invoice Number", value: id, confidence: 0.95 },
      { label: "Vendor GSTIN", value: "24ABCDE1234F1Z5", confidence: 0.98 },
      { label: "Invoice Date", value: "14-06-2026", confidence: 0.9 },
      { label: "Taxable Value", value: "₹84,200.00", confidence: 0.88 },
      { label: "Tax Amount", value: "₹15,156.00", confidence: 0.81 },
      { label: "Total", value: "₹99,356.00", confidence: 0.93 },
    ],
    flags: [
      { type: "Duplicate invoice", detail: "Matches INV-22l4 submitted 2026-06-14 03:12, same vendor." },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public API — swap USE_MOCK to false once the backend routes exist.
// ---------------------------------------------------------------------------

export async function fetchStats() {
  if (USE_MOCK) {
    await delay();
    return MOCK_STATS;
  }
  const { data } = await client.get("/stats");
  return data;
}

export async function fetchRiskDistribution() {
  if (USE_MOCK) {
    await delay();
    return MOCK_RISK_DISTRIBUTION;
  }
  const { data } = await client.get("/stats/risk-distribution");
  return data;
}

export async function fetchFolders() {
  if (USE_MOCK) {
    await delay();
    return MOCK_FOLDERS;
  }
  const { data } = await client.get("/folders");
  return data;
}

export async function fetchTickets(params = {}) {
  if (USE_MOCK) {
    await delay();
    let rows = [...MOCK_TICKETS];
    if (params.status && params.status !== "all") rows = rows.filter((t) => t.status === params.status);
    if (params.minRisk != null) rows = rows.filter((t) => t.riskScore >= params.minRisk);
    if (params.minConfidence != null) rows = rows.filter((t) => t.confidenceScore >= params.minConfidence);
    if (params.query) {
      const q = params.query.toLowerCase();
      rows = rows.filter((t) => t.vendor.toLowerCase().includes(q) || t.invoiceId.toLowerCase().includes(q));
    }
    rows.sort((a, b) => b.riskScore - a.riskScore);
    return rows;
  }
  const { data } = await client.get("/tickets", { params });
  return data;
}

export async function fetchTicket(id) {
  if (USE_MOCK) {
    await delay();
    return MOCK_TICKETS.find((t) => t.id === id);
  }
  const { data } = await client.get(`/tickets/${id}`);
  return data;
}

export async function fetchInvoiceDetail(id) {
  if (USE_MOCK) {
    await delay();
    return mockInvoiceDetail(id);
  }
  const { data } = await client.get(`/invoices/${id}`);
  return data;
}

export async function uploadInvoiceBatch(files) {
  if (USE_MOCK) {
    await delay(600);
    return files.map((f, i) => ({
      filename: f.name,
      status: i % 5 === 0 ? "needs-review" : "accepted",
    }));
  }
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const { data } = await client.post("/invoices/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function submitResolution(ticketId, payload) {
  if (USE_MOCK) {
    await delay();
    return { ok: true, ticketId, ...payload };
  }
  const { data } = await client.post(`/tickets/${ticketId}/resolve`, payload);
  return data;
}

export async function submitMergeDecision(payload) {
  if (USE_MOCK) {
    await delay();
    return { ok: true, ...payload };
  }
  const { data } = await client.post("/tickets/merge", payload);
  return data;
}

export async function submitVendorCorrection(payload) {
  if (USE_MOCK) {
    await delay();
    return { ok: true, ...payload };
  }
  const { data } = await client.post("/vendors/correct", payload);
  return data;
}

export async function generateReport(payload) {
  if (USE_MOCK) {
    await delay(500);
    return { ok: true, url: null, ...payload };
  }
  const { data } = await client.post("/reports/generate", payload);
  return data;
}

export default client;
