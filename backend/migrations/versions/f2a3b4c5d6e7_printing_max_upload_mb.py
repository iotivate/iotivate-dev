"""printing: admin-configurable max upload size (max_upload_mb)

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-10-07 00:00:00.000000

Adds printsettings.max_upload_mb (default 100). Server default backfills the
existing settings row, then is dropped so the ORM owns the value.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, Sequence[str], None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('printsettings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('max_upload_mb', sa.Integer(), nullable=False, server_default='100')
        )
    with op.batch_alter_table('printsettings', schema=None) as batch_op:
        batch_op.alter_column('max_upload_mb', server_default=None)


def downgrade() -> None:
    with op.batch_alter_table('printsettings', schema=None) as batch_op:
        batch_op.drop_column('max_upload_mb')
