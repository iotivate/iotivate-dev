"""add zone, rule, and ruleevent tables

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-05 00:00:00.000000

New public tables need RLS enabled (mirrors c3d4e5f6a7b8 / e5f6a7b8c9d0):
Supabase PostgREST exposes them to anon/authenticated until RLS is on. The
FastAPI backend connects as the DB owner, so RLS does not restrict it.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = ["zone", "rule", "ruleevent"]


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        'zone',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
        sa.Column('points', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['device.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('zone', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_zone_device_id'), ['device_id'], unique=False)

    op.create_table(
        'rule',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('zone_id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
        sa.Column('trigger_type', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('dwell_seconds', sa.Integer(), nullable=True),
        sa.Column('occupancy_threshold', sa.Integer(), nullable=True),
        sa.Column('cooldown_seconds', sa.Integer(), nullable=False),
        sa.Column('action_dashboard', sa.Boolean(), nullable=False),
        sa.Column('action_email', sa.Boolean(), nullable=False),
        sa.Column('notify_email', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['zone_id'], ['zone.id']),
        sa.ForeignKeyConstraint(['device_id'], ['device.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('rule', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_rule_zone_id'), ['zone_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_rule_device_id'), ['device_id'], unique=False)

    op.create_table(
        'ruleevent',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rule_id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('zone_id', sa.Integer(), nullable=False),
        sa.Column('trigger_type', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('fired_at', sa.DateTime(), nullable=False),
        sa.Column('detail', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['rule_id'], ['rule.id']),
        sa.ForeignKeyConstraint(['device_id'], ['device.id']),
        sa.ForeignKeyConstraint(['zone_id'], ['zone.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('ruleevent', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ruleevent_rule_id'), ['rule_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_ruleevent_device_id'), ['device_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_ruleevent_fired_at'), ['fired_at'], unique=False)

    if _is_postgres():
        for table in RLS_TABLES:
            op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    with op.batch_alter_table('ruleevent', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ruleevent_fired_at'))
        batch_op.drop_index(batch_op.f('ix_ruleevent_device_id'))
        batch_op.drop_index(batch_op.f('ix_ruleevent_rule_id'))
    op.drop_table('ruleevent')

    with op.batch_alter_table('rule', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_rule_device_id'))
        batch_op.drop_index(batch_op.f('ix_rule_zone_id'))
    op.drop_table('rule')

    with op.batch_alter_table('zone', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_zone_device_id'))
    op.drop_table('zone')
