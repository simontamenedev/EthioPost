"""add-fsp-ids

Revision ID: 234d5dedfeef
Revises: e732066c3dd1
Create Date: 2026-11-09 15:26:46.482348
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '234d5dedfeef'
down_revision: Union[str, None] = 'e732066c3dd1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ACTIVE = sa.text('deleted_at IS NULL')

# table -> (old non-unique indexes: name -> columns, date column)
OLD_INDEXES = {
    'agent_transactions': {
        'ix_agent_transactions_agent_date': ['agent_shortcode', 'txn_date'],
        'ix_agent_transactions_date_service': ['txn_date', 'service_type'],
    },
    'customer_registrations': {
        'ix_customer_registrations_agent_date': ['agent_shortcode', 'reg_date'],
    },
    'customer_upgrades': {
        'ix_customer_upgrades_agent_date': ['agent_shortcode', 'upgrade_date'],
    },
}

NEW_INDEXES = {
    'agent_transactions': {
        'ix_agent_transactions_fsp_agent_date': ['fsp_id', 'agent_shortcode', 'txn_date'],
        'ix_agent_transactions_fsp_date_service': ['fsp_id', 'txn_date', 'service_type'],
    },
    'customer_registrations': {
        'ix_customer_registrations_fsp_agent_date': ['fsp_id', 'agent_shortcode', 'reg_date'],
    },
    'customer_upgrades': {
        'ix_customer_upgrades_fsp_agent_date': ['fsp_id', 'agent_shortcode', 'upgrade_date'],
    },
}


def upgrade() -> None:
    for table in OLD_INDEXES:
        # 1. add nullable, backfill from the batch each row came from, then make required
        op.add_column(table, sa.Column('fsp_id', sa.Uuid(), nullable=True))
        op.execute(
            f"UPDATE {table} SET fsp_id = b.fsp_id "
            f"FROM import_batches b WHERE b.id = {table}.import_batch_id"
        )
        op.alter_column(table, 'fsp_id', existing_type=sa.Uuid(), nullable=False)

        # 2. swap indexes
        for name in OLD_INDEXES[table]:
            op.drop_index(name, table_name=table)
        op.drop_index(f'uq_{table}_row_hash_active', table_name=table, postgresql_where=ACTIVE)

        for name, cols in NEW_INDEXES[table].items():
            op.create_index(name, table, cols, unique=False)
        op.create_index(f'ix_{table}_fsp_id', table, ['fsp_id'], unique=False)
        op.create_index(
            f'uq_{table}_fsp_row_hash_active', table, ['fsp_id', 'row_hash'],
            unique=True, postgresql_where=ACTIVE, sqlite_where=ACTIVE,
        )

        # 3. named foreign key so downgrade can drop it
        op.create_foreign_key(
            f'fk_{table}_fsp_id', table, 'financial_service_providers', ['fsp_id'], ['id']
        )


def downgrade() -> None:
    for table in OLD_INDEXES:
        op.drop_constraint(f'fk_{table}_fsp_id', table, type_='foreignkey')

        op.drop_index(f'uq_{table}_fsp_row_hash_active', table_name=table,
                      postgresql_where=ACTIVE, sqlite_where=ACTIVE)
        op.drop_index(f'ix_{table}_fsp_id', table_name=table)
        for name in NEW_INDEXES[table]:
            op.drop_index(name, table_name=table)

        op.create_index(f'uq_{table}_row_hash_active', table, ['row_hash'],
                        unique=True, postgresql_where=ACTIVE)
        for name, cols in OLD_INDEXES[table].items():
            op.create_index(name, table, cols, unique=False)

        op.drop_column(table, 'fsp_id')