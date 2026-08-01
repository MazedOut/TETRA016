"""SQLAlchemy engine/session setup. Starts on SQLite; DATABASE_URL swaps to Postgres later.
Also provides auto_migrate() which adds any model columns missing from the live DB
without dropping data — call this on every startup after create_all().
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL
import logging

logger = logging.getLogger(__name__)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _sqlalchemy_type_to_ddl(col_type) -> str:
    """Convert a SQLAlchemy column type to a SQLite-compatible DDL type string."""
    type_name = type(col_type).__name__.upper()
    mapping = {
        "INTEGER": "INTEGER",
        "BIGINTEGER": "INTEGER",
        "SMALLINTEGER": "INTEGER",
        "STRING": "TEXT",
        "TEXT": "TEXT",
        "VARCHAR": "TEXT",
        "FLOAT": "REAL",
        "NUMERIC": "REAL",
        "BOOLEAN": "INTEGER",
        "DATETIME": "DATETIME",
        "DATE": "DATE",
        "JSON": "JSON",
    }
    return mapping.get(type_name, "TEXT")


def auto_migrate():
    """
    Dev-mode auto-migration: for every SQLAlchemy model registered on Base,
    compare expected columns against what actually exists in the live SQLite file.
    Any column present in the model but absent from the table is added via
    ALTER TABLE ... ADD COLUMN.

    Rules:
    - Only adds columns (never drops, renames, or changes types).
    - Skips columns that can't be safely added (NOT NULL with no default on a
      non-empty table) and logs a clear warning instead of crashing.
    - Safe to call on every startup — no-ops when schema is already current.
    """
    inspector = inspect(engine)
    existing_table_names = set(inspector.get_table_names())

    for mapper in Base.registry.mappers:
        table = mapper.local_table
        table_name = table.name

        if table_name not in existing_table_names:
            # Table doesn't exist at all — create_all() handles this; skip.
            continue

        existing_cols = {col["name"] for col in inspector.get_columns(table_name)}

        for col in table.columns:
            if col.name in existing_cols:
                continue  # already present

            # Safety check: can we add this column without supplying data for existing rows?
            has_server_default = col.server_default is not None
            has_python_default = col.default is not None
            col_is_nullable = col.nullable

            if not col_is_nullable and not has_server_default and not has_python_default:
                # Check if the table is non-empty
                with engine.connect() as conn:
                    count = conn.execute(
                        text(f"SELECT COUNT(*) FROM \"{table_name}\"")
                    ).scalar()
                if count > 0:
                    logger.warning(
                        "AUTO-MIGRATE SKIPPED: Table '%s' column '%s' is NOT NULL with "
                        "no default and the table has %d existing rows. "
                        "Add a default or nullable=True to the model to auto-migrate safely.",
                        table_name, col.name, count,
                    )
                    continue

            ddl_type = _sqlalchemy_type_to_ddl(col.type)
            default_clause = ""
            if has_server_default:
                default_clause = f" DEFAULT {col.server_default.arg}"
            elif has_python_default and hasattr(col.default, "arg") and not callable(col.default.arg):
                default_clause = f" DEFAULT '{col.default.arg}'"
            elif col_is_nullable:
                default_clause = " DEFAULT NULL"

            try:
                with engine.begin() as conn:
                    sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {ddl_type}{default_clause}'
                    conn.execute(text(sql))
                logger.info(
                    "AUTO-MIGRATE: Added column '%s.%s' (%s%s)",
                    table_name, col.name, ddl_type, default_clause,
                )
            except Exception as exc:
                logger.warning(
                    "AUTO-MIGRATE FAILED: Could not add '%s.%s': %s",
                    table_name, col.name, exc,
                )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
