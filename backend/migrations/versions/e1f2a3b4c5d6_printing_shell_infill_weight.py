"""printing: shell+infill weight model (wall_thickness, infill_percent, surface_cm2)

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-10-06 00:00:00.000000

Replaces the flat fill-factor weight estimate with a shell + infill model.
Adds wall_thickness_mm / infill_percent to printsettings and surface_cm2 to
printorder. The legacy fill_factor column is kept (unused) to avoid a destructive
drop. Server defaults backfill existing rows, then are dropped so the ORM owns them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('printsettings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('wall_thickness_mm', sa.Float(), nullable=False, server_default='1.2')
        )
        batch_op.add_column(
            sa.Column('infill_percent', sa.Float(), nullable=False, server_default='15')
        )
    with op.batch_alter_table('printorder', schema=None) as batch_op:
        batch_op.add_column(sa.Column('surface_cm2', sa.Float(), nullable=True))

    # Drop server defaults — the application/ORM supplies these going forward.
    with op.batch_alter_table('printsettings', schema=None) as batch_op:
        batch_op.alter_column('wall_thickness_mm', server_default=None)
        batch_op.alter_column('infill_percent', server_default=None)


def downgrade() -> None:
    with op.batch_alter_table('printorder', schema=None) as batch_op:
        batch_op.drop_column('surface_cm2')
    with op.batch_alter_table('printsettings', schema=None) as batch_op:
        batch_op.drop_column('infill_percent')
        batch_op.drop_column('wall_thickness_mm')
