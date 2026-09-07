"""add zone_occupancy_sample table

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-09-07 00:10:00.000000

New public table needs RLS enabled (mirrors the device/zone table migrations).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, Sequence[str], None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        'zoneoccupancysample',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('zone_id', sa.Integer(), nullable=False),
        sa.Column('occupancy', sa.Integer(), nullable=False),
        sa.Column('sampled_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['device.id']),
        sa.ForeignKeyConstraint(['zone_id'], ['zone.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('zoneoccupancysample', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_zoneoccupancysample_device_id'), ['device_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_zoneoccupancysample_zone_id'), ['zone_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_zoneoccupancysample_sampled_at'), ['sampled_at'], unique=False)

    if _is_postgres():
        op.execute('ALTER TABLE public."zoneoccupancysample" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    with op.batch_alter_table('zoneoccupancysample', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_zoneoccupancysample_sampled_at'))
        batch_op.drop_index(batch_op.f('ix_zoneoccupancysample_zone_id'))
        batch_op.drop_index(batch_op.f('ix_zoneoccupancysample_device_id'))
    op.drop_table('zoneoccupancysample')
