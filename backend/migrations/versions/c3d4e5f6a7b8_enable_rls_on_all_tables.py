"""enable row level security on all tables

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-02-19 20:45:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# All public tables that need RLS enabled.
# With RLS on and no policies, the Supabase anon/authenticated roles
# get zero access. The FastAPI backend connects as the DB owner,
# so RLS does not apply to it.
TABLES = [
    "contactmessage",
    "project",
    "tool",
    "user",
    "purchase",
    "webhookevent",
]


def upgrade() -> None:
    """Enable RLS on every public table to block Supabase PostgREST access."""
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Disable RLS on every public table."""
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" DISABLE ROW LEVEL SECURITY')
