"""
FastAPI entrypoint. Wires together the pipeline stages:
ingestion -> extraction -> classification -> reconciliation -> scoring -> ai_layer -> audit_trail
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI-Powered Invoice Risk Scanner")
from app.db.database import Base, engine
from app.models.invoice import Invoice
from app.models.ticket import Ticket
from app.models.vendor import Vendor
from app.models.ledger_entry import LedgerEntry
Base.metadata.create_all(engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# Routers get included here once built, e.g.:
# from app.api import routes_upload, routes_invoices, routes_tickets, routes_dashboard, routes_reports
# app.include_router(routes_upload.router, prefix="/upload", tags=["upload"])
# app.include_router(routes_invoices.router, prefix="/invoices", tags=["invoices"])
# app.include_router(routes_tickets.router, prefix="/tickets", tags=["tickets"])
# app.include_router(routes_dashboard.router, prefix="/dashboard", tags=["dashboard"])
# app.include_router(routes_reports.router, prefix="/reports", tags=["reports"])

from app.api import routes_upload
app.include_router(routes_upload.router, prefix="/upload", tags=["upload"])

from app.api import routes_tickets, routes_dashboard
app.include_router(routes_tickets.router, prefix="/tickets", tags=["tickets"])
app.include_router(routes_dashboard.router, prefix="/dashboard", tags=["dashboard"])

from app.api import routes_frontend_adapter
app.include_router(routes_frontend_adapter.router, prefix="/api", tags=["frontend-adapter"])