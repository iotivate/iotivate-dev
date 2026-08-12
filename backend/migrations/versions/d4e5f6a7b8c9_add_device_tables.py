"""add device and deviceuser tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'device',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
        sa.Column('device_type', sqlmodel.sql.sqltypes.AutoString(length=30), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('pairing_state', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('pairing_code', sqlmodel.sql.sqltypes.AutoString(length=16), nullable=True),
        sa.Column('pairing_code_expires_at', sa.DateTime(), nullable=True),
        sa.Column('device_token_hash', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True),
        sa.Column('firmware_version', sqlmodel.sql.sqltypes.AutoString(length=40), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('paired_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('device', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_device_owner_id'), ['owner_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_device_pairing_code'), ['pairing_code'], unique=False)

    op.create_table(
        'deviceuser',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['device.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('device_id', 'user_id', name='uq_deviceuser_device_user'),
    )
    with op.batch_alter_table('deviceuser', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_deviceuser_device_id'), ['device_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_deviceuser_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('deviceuser', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_deviceuser_user_id'))
        batch_op.drop_index(batch_op.f('ix_deviceuser_device_id'))
    op.drop_table('deviceuser')

    with op.batch_alter_table('device', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_device_pairing_code'))
        batch_op.drop_index(batch_op.f('ix_device_owner_id'))
    op.drop_table('device')
