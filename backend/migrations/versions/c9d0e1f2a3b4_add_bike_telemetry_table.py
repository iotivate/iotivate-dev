"""add bike_telemetry table

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-09-25 00:00:00.000000

New public table needs RLS enabled (mirrors the device/zone/sample migrations).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, Sequence[str], None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        'biketelemetry',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('speed', sa.Float(), nullable=True),
        sa.Column('heading', sa.Float(), nullable=True),
        sa.Column('battery', sa.Integer(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['device.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('biketelemetry', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_biketelemetry_device_id'), ['device_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_biketelemetry_recorded_at'), ['recorded_at'], unique=False)

    if _is_postgres():
        op.execute('ALTER TABLE public."biketelemetry" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    with op.batch_alter_table('biketelemetry', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_biketelemetry_recorded_at'))
        batch_op.drop_index(batch_op.f('ix_biketelemetry_device_id'))
    op.drop_table('biketelemetry')
