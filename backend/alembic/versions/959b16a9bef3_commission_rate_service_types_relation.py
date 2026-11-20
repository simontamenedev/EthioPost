"""commission rate service types relation

Revision ID: 959b16a9bef3
Revises: 12d2b558536b
Create Date: 2026-11-18 10:01:21.060354
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '959b16a9bef3'
down_revision: Union[str, None] = '12d2b558536b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.create_table(
        "commission_rate_service_types",
        sa.Column("commission_rate_id", sa.Uuid(), nullable=False),
        sa.Column("service_type_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["commission_rate_id"], ["commission_rates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_type_id"], ["service_types.id"]),
        sa.PrimaryKeyConstraint("commission_rate_id", "service_type_id"),
    )
    op.create_index(
        "ix_commission_rate_service_types_service_type_id",
        "commission_rate_service_types",
        ["service_type_id"],
    )

    # Carry existing data over: match old text to ServiceType.csv_label or .name
    conn = op.get_bind()
    st = sa.table(
        "service_types",
        sa.column("id", sa.Uuid),
        sa.column("name", sa.String),
        sa.column("csv_label", sa.String),
        sa.column("deleted_at", sa.DateTime),
    )
    rates = sa.table(
        "commission_rates",
        sa.column("id", sa.Uuid),
        sa.column("service_name", sa.String),
        sa.column("service_types", sa.JSON),
    )
    link = sa.table(
        "commission_rate_service_types",
        sa.column("commission_rate_id", sa.Uuid),
        sa.column("service_type_id", sa.Uuid),
    )

    lookup: dict[str, object] = {}
    for sid, name, label in conn.execute(
        sa.select(st.c.id, st.c.name, st.c.csv_label).where(st.c.deleted_at.is_(None))
    ):
        for key in (name, label):
            if key:
                lookup[key.strip().lower()] = sid

    for rid, rname, old in conn.execute(sa.select(rates.c.id, rates.c.service_name, rates.c.service_types)):
        seen: set = set()
        for text in old or []:
            sid = lookup.get(text.strip().lower())
            if sid is None:
                print(f"[migration] rate '{rname}': no ServiceType matches '{text}', link manually")
            elif sid not in seen:
                seen.add(sid)
                conn.execute(link.insert().values(commission_rate_id=rid, service_type_id=sid))

    op.drop_column("commission_rates", "service_types")


def downgrade() -> None:
    op.add_column("commission_rates", sa.Column("service_types", sa.JSON(), nullable=True))
    op.drop_index(
        "ix_commission_rate_service_types_service_type_id",
        table_name="commission_rate_service_types",
    )
    op.drop_table("commission_rate_service_types")