"""add service target period

Revision ID: 976b0262c5d6
Revises: 005d7754d9b0
Create Date: 2026-11-19 15:44:34.522051
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '976b0262c5d6'
down_revision: Union[str, None] = '005d7754d9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "service_type_target_periods",
        sa.Column("service_type_target_id", sa.Uuid(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("target_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("deleted_by", sa.Uuid(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["service_type_target_id"],
            ["service_type_targets.id"],
            name="fk_service_type_target_periods_target",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"]),
        sa.CheckConstraint("end_date >= start_date", name="ck_service_type_target_periods_dates_order"),
        sa.CheckConstraint("target_value >= 0", name="ck_service_type_target_periods_value_non_negative"),
    )
    op.create_index(
        "ix_service_type_target_periods_service_type_target_id",
        "service_type_target_periods",
        ["service_type_target_id"],
    )
    op.create_index(
        "ix_service_type_target_periods_start_date",
        "service_type_target_periods",
        ["start_date"],
    )
    op.create_index(
        "uq_service_type_target_periods_target_start_active",
        "service_type_target_periods",
        ["service_type_target_id", "start_date"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("service_type_target_periods")