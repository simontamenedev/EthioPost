"""add parent to district

Revision ID: 789a404de477
Revises: 959b16a9bef3
Create Date: 2026-11-18 11:08:26.882939
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '789a404de477'
down_revision: Union[str, None] = '959b16a9bef3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # parent_id is a UUID to match districts.id.
    op.add_column("districts", sa.Column("parent_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_districts_parent_id"), "districts", ["parent_id"], unique=False)
    op.create_foreign_key(
        "fk_districts_parent_id_districts",
        "districts",
        "districts",
        ["parent_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_districts_parent_id_districts", "districts", type_="foreignkey")
    op.drop_index(op.f("ix_districts_parent_id"), table_name="districts")
    op.drop_column("districts", "parent_id")