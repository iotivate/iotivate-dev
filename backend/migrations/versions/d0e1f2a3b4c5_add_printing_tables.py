"""add 3d-printing tables

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-10-05 00:00:00.000000

New public tables get RLS on Postgres (mirrors the device/zone/bike migrations).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


revision: str = 'd0e1f2a3b4c5'
down_revision: Union[str, Sequence[str], None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = ["printfilament", "printcolor", "printsettings", "shippingzone", "printorder"]


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        'printfilament',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('type', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
        sa.Column('density_g_cm3', sa.Float(), nullable=False),
        sa.Column('rate_per_gram', sa.Float(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'printcolor',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('filament_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=40), nullable=False),
        sa.Column('hex', sqlmodel.sql.sqltypes.AutoString(length=9), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['filament_id'], ['printfilament.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('printcolor', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_printcolor_filament_id'), ['filament_id'], unique=False)

    op.create_table(
        'printsettings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('setup_fee', sa.Float(), nullable=False),
        sa.Column('min_order', sa.Float(), nullable=False),
        sa.Column('fill_factor', sa.Float(), nullable=False),
        sa.Column('max_x_mm', sa.Float(), nullable=False),
        sa.Column('max_y_mm', sa.Float(), nullable=False),
        sa.Column('max_z_mm', sa.Float(), nullable=False),
        sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(length=8), nullable=False),
        sa.Column('lead_time_text', sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
        sa.Column('service_open', sa.Boolean(), nullable=False),
        sa.Column('design_enabled', sa.Boolean(), nullable=False),
        sa.Column('estimate_disclaimer', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'shippingzone',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
        sa.Column('flat_rate', sa.Float(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'printorder',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('source', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('customer_name', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('customer_email', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('customer_phone', sqlmodel.sql.sqltypes.AutoString(length=40), nullable=True),
        sa.Column('stl_url', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('filament_id', sa.Integer(), nullable=True),
        sa.Column('color_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('volume_cm3', sa.Float(), nullable=True),
        sa.Column('est_weight_g', sa.Float(), nullable=True),
        sa.Column('dim_x_mm', sa.Float(), nullable=True),
        sa.Column('dim_y_mm', sa.Float(), nullable=True),
        sa.Column('dim_z_mm', sa.Float(), nullable=True),
        sa.Column('design_brief', sqlmodel.sql.sqltypes.AutoString(length=4000), nullable=True),
        sa.Column('reference_url', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('shipping_zone_id', sa.Integer(), nullable=True),
        sa.Column('shipping_address', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('items_subtotal', sa.Float(), nullable=True),
        sa.Column('shipping_cost', sa.Float(), nullable=True),
        sa.Column('total_estimate', sa.Float(), nullable=True),
        sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(length=2000), nullable=True),
        sa.ForeignKeyConstraint(['filament_id'], ['printfilament.id']),
        sa.ForeignKeyConstraint(['color_id'], ['printcolor.id']),
        sa.ForeignKeyConstraint(['shipping_zone_id'], ['shippingzone.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('printorder', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_printorder_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_printorder_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_printorder_customer_email'), ['customer_email'], unique=False)

    if _is_postgres():
        for t in RLS_TABLES:
            op.execute(f'ALTER TABLE public."{t}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    with op.batch_alter_table('printorder', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_printorder_customer_email'))
        batch_op.drop_index(batch_op.f('ix_printorder_status'))
        batch_op.drop_index(batch_op.f('ix_printorder_created_at'))
    op.drop_table('printorder')
    op.drop_table('shippingzone')
    op.drop_table('printsettings')
    with op.batch_alter_table('printcolor', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_printcolor_filament_id'))
    op.drop_table('printcolor')
    op.drop_table('printfilament')
