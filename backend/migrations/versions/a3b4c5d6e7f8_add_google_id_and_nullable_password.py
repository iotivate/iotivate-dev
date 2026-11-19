"""add google_id + make password nullable (Google sign-in)

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-11-19 00:00:00.000000

Adds user.google_id (unique) and makes hashed_password nullable so social-login
users can exist without a password.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, Sequence[str], None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('google_id', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True)
        )
        batch_op.alter_column(
            'hashed_password',
            existing_type=sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=True,
        )
        batch_op.create_index(batch_op.f('ix_user_google_id'), ['google_id'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_google_id'))
        batch_op.alter_column(
            'hashed_password',
            existing_type=sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        )
        batch_op.drop_column('google_id')
