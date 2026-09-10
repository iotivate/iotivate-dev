"""enable row level security on device tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-31 00:05:00.000000

Mirrors c3d4e5f6a7b8: new public tables are exposed by Supabase PostgREST to
the anon/authenticated roles until RLS is enabled. The FastAPI backend connects
as the DB owner, so RLS does not restrict it.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ["device", "deviceuser"]


def _is_postgres() -> bool:
    # RLS and the `public` schema are Postgres-only; local dev / tests are SQLite.
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    if not _is_postgres():
        return
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" DISABLE ROW LEVEL SECURITY')
