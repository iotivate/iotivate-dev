"""add subscription fields to user

Revision ID: a1b2c3d4e5f6
Revises: e47faf36f565
Create Date: 2026-02-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e47faf36f565'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add subscription fields to user table."""
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('lemon_subscription_id', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True)
        )
        batch_op.add_column(
            sa.Column('subscription_status', sqlmodel.sql.sqltypes.AutoString(length=30), nullable=True)
        )
        batch_op.add_column(
            sa.Column('subscription_ends_at', sa.DateTime(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('subscription_updated_at', sa.DateTime(), nullable=True)
        )
        batch_op.create_index(
            batch_op.f('ix_user_lemon_subscription_id'), ['lemon_subscription_id'], unique=False
        )


def downgrade() -> None:
    """Remove subscription fields from user table."""
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_lemon_subscription_id'))
        batch_op.drop_column('subscription_updated_at')
        batch_op.drop_column('subscription_ends_at')
        batch_op.drop_column('subscription_status')
        batch_op.drop_column('lemon_subscription_id')
