"""commission rule-fsp-service-type

Revision ID: cc7aaa4ee2cd
Revises: c2d99703e426
Create Date: 2026-11-09 09:38:39.394144
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'cc7aaa4ee2cd'
down_revision: Union[str, None] = 'c2d99703e426'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_STATUS = sa.Enum('active', 'inactive', name='status', native_enum=False, length=20)
_AUDIT_COLS = lambda: [  # noqa: E731
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('status', _STATUS, server_default='active', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('updated_by', sa.Uuid(), nullable=True),
    sa.Column('deleted_by', sa.Uuid(), nullable=True),
]
_AUDIT_FKS = lambda: [  # noqa: E731
    sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    sa.ForeignKeyConstraint(['deleted_by'], ['users.id']),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
]


def upgrade() -> None:
    op.create_table(
        'financial_service_providers',
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        *_AUDIT_COLS(), *_AUDIT_FKS(),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_financial_service_providers_status'), 'financial_service_providers', ['status'], unique=False)
    op.create_index('uq_fsp_code_active', 'financial_service_providers', ['code'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.create_index('uq_fsp_name_active', 'financial_service_providers', ['name'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))

    op.create_table(
        'service_types',
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('csv_label', sa.String(length=50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        *_AUDIT_COLS(), *_AUDIT_FKS(),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_service_types_csv_label'), 'service_types', ['csv_label'], unique=False)
    op.create_index('uq_service_types_code_active', 'service_types', ['code'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))

    op.create_table(
        'commission_rules',
        sa.Column('fsp_id', sa.Uuid(), nullable=False),
        sa.Column('service_type_id', sa.Uuid(), nullable=False),
        sa.Column('qualifier', sa.String(length=100), nullable=True),
        sa.Column('min_amount', sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column('max_amount', sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column('commission_type', sa.Enum('flat', 'percent', name='commissiontype', native_enum=False, length=20), nullable=False),
        sa.Column('basis', sa.Enum('txn_amount', 'fee_collected', 'revenue', name='commissionbasis', native_enum=False, length=20), nullable=True),
        sa.Column('rate', sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column('conditions', sa.Text(), nullable=True),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('effective_to', sa.Date(), nullable=True),
        *_AUDIT_COLS(), *_AUDIT_FKS(),
        sa.CheckConstraint('max_amount IS NULL OR min_amount IS NULL OR max_amount >= min_amount', name='ck_commission_rules_band'),
        sa.ForeignKeyConstraint(['fsp_id'], ['financial_service_providers.id']),
        sa.ForeignKeyConstraint(['service_type_id'], ['service_types.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_commission_rules_effective_from'), 'commission_rules', ['effective_from'], unique=False)
    op.create_index(op.f('ix_commission_rules_fsp_id'), 'commission_rules', ['fsp_id'], unique=False)
    op.create_index('ix_commission_rules_lookup', 'commission_rules', ['fsp_id', 'service_type_id', 'effective_from'], unique=False)
    op.create_index(op.f('ix_commission_rules_qualifier'), 'commission_rules', ['qualifier'], unique=False)
    op.create_index(op.f('ix_commission_rules_service_type_id'), 'commission_rules', ['service_type_id'], unique=False)
    op.create_index(op.f('ix_commission_rules_status'), 'commission_rules', ['status'], unique=False)

    # import_batches.fsp_id: add as NULLABLE, backfill existing rows, then make NOT NULL.
    op.add_column('import_batches', sa.Column('fsp_id', sa.Uuid(), nullable=True))
    conn = op.get_bind()
    if conn.execute(sa.text("SELECT 1 FROM import_batches LIMIT 1")).first():
        # Existing imports need a provider. CHANGE 'TELEBIRR'/'Telebirr' if they belong to another FSP.
        fsp_id = uuid.uuid4()
        conn.execute(
            sa.text(
                "INSERT INTO financial_service_providers (id, code, name, description, status) "
                "VALUES (:id, 'TELEBIRR', 'Telebirr', 'Created by migration for pre-existing imports', 'active')"
            ).bindparams(sa.bindparam('id', type_=sa.Uuid())),
            {'id': fsp_id},
        )
        conn.execute(
            sa.text("UPDATE import_batches SET fsp_id = :id").bindparams(sa.bindparam('id', type_=sa.Uuid())),
            {'id': fsp_id},
        )
    op.alter_column('import_batches', 'fsp_id', existing_type=sa.Uuid(), nullable=False)

    op.drop_index(op.f('uq_import_batches_dataset_hash_active'), table_name='import_batches', postgresql_where='(deleted_at IS NULL)')
    op.create_index(op.f('ix_import_batches_fsp_id'), 'import_batches', ['fsp_id'], unique=False)
    op.create_index('uq_import_batches_fsp_dataset_hash_active', 'import_batches', ['fsp_id', 'dataset', 'file_hash'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.create_foreign_key('fk_import_batches_fsp_id', 'import_batches', 'financial_service_providers', ['fsp_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_import_batches_fsp_id', 'import_batches', type_='foreignkey')
    op.drop_index('uq_import_batches_fsp_dataset_hash_active', table_name='import_batches', postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.drop_index(op.f('ix_import_batches_fsp_id'), table_name='import_batches')
    # Re-creating the old unique index fails if the same file was imported under two FSPs.
    op.create_index(op.f('uq_import_batches_dataset_hash_active'), 'import_batches', ['dataset', 'file_hash'], unique=True, postgresql_where='(deleted_at IS NULL)')
    op.drop_column('import_batches', 'fsp_id')

    op.drop_index(op.f('ix_commission_rules_status'), table_name='commission_rules')
    op.drop_index(op.f('ix_commission_rules_service_type_id'), table_name='commission_rules')
    op.drop_index(op.f('ix_commission_rules_qualifier'), table_name='commission_rules')
    op.drop_index('ix_commission_rules_lookup', table_name='commission_rules')
    op.drop_index(op.f('ix_commission_rules_fsp_id'), table_name='commission_rules')
    op.drop_index(op.f('ix_commission_rules_effective_from'), table_name='commission_rules')
    op.drop_table('commission_rules')
    op.drop_index('uq_service_types_code_active', table_name='service_types', postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.drop_index(op.f('ix_service_types_csv_label'), table_name='service_types')
    op.drop_table('service_types')
    op.drop_index('uq_fsp_name_active', table_name='financial_service_providers', postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.drop_index('uq_fsp_code_active', table_name='financial_service_providers', postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.drop_index(op.f('ix_financial_service_providers_status'), table_name='financial_service_providers')
    op.drop_table('financial_service_providers')