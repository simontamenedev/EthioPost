"""add sortorder

Revision ID: 005d7754d9b0
Revises: 789a404de477
Create Date: 2026-11-19 10:32:51.304165
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '005d7754d9b0'
down_revision: Union[str, None] = '789a404de477'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "service_types",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
    )
    op.create_index("ix_service_types_sort_order", "service_types", ["sort_order"])


def downgrade() -> None:
    op.drop_index("ix_service_types_sort_order", table_name="service_types")
    op.drop_column("service_types", "sort_order")