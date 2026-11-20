"""service type targets

Revision ID: 8f3f6813d0a9
Revises: 79b478b8f74e
Create Date: 2026-11-16 10:49:43.024634
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8f3f6813d0a9'
down_revision: Union[str, None] = '79b478b8f74e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('service_type_targets',
    sa.Column('name', sa.String(length=150), nullable=True),
    sa.Column('start_date', sa.Date(), nullable=False),
    sa.Column('end_date', sa.Date(), nullable=False),
    sa.Column('target_value', sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.Enum('active', 'inactive', name='status', native_enum=False, length=20), server_default='active', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('updated_by', sa.Uuid(), nullable=True),
    sa.Column('deleted_by', sa.Uuid(), nullable=True),
    sa.CheckConstraint('target_value >= 0', name='ck_service_type_targets_value_non_negative'),
    sa.CheckConstraint('end_date >= start_date', name='ck_service_type_targets_dates_order'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_service_type_targets_start_date'), 'service_type_targets', ['start_date'], unique=False)
    op.create_index(op.f('ix_service_type_targets_end_date'), 'service_type_targets', ['end_date'], unique=False)

    op.create_table('district_targets',
    sa.Column('service_type_target_id', sa.Uuid(), nullable=False),
    sa.Column('district_id', sa.Uuid(), nullable=False),
    sa.Column('target_value', sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.Enum('active', 'inactive', name='status', native_enum=False, length=20), server_default='active', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('updated_by', sa.Uuid(), nullable=True),
    sa.Column('deleted_by', sa.Uuid(), nullable=True),
    sa.CheckConstraint('target_value >= 0', name='ck_district_targets_value_non_negative'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['service_type_target_id'], ['service_type_targets.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_district_targets_district_id'), 'district_targets', ['district_id'], unique=False)
    op.create_index(op.f('ix_district_targets_service_type_target_id'), 'district_targets', ['service_type_target_id'], unique=False)
    op.create_index('uq_district_targets_target_district_active', 'district_targets', ['service_type_target_id', 'district_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))

    op.create_table('service_type_target_items',
    sa.Column('service_type_target_id', sa.Uuid(), nullable=False),
    sa.Column('service_type_id', sa.Uuid(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.Enum('active', 'inactive', name='status', native_enum=False, length=20), server_default='active', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('updated_by', sa.Uuid(), nullable=True),
    sa.Column('deleted_by', sa.Uuid(), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['service_type_id'], ['service_types.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['service_type_target_id'], ['service_type_targets.id'], name='fk_service_type_target_items_target', ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_service_type_target_items_service_type_id'), 'service_type_target_items', ['service_type_id'], unique=False)
    op.create_index(op.f('ix_service_type_target_items_service_type_target_id'), 'service_type_target_items', ['service_type_target_id'], unique=False)
    op.create_index('uq_service_type_target_items_target_service_active', 'service_type_target_items', ['service_type_target_id', 'service_type_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))


def downgrade() -> None:
    op.drop_index('uq_service_type_target_items_target_service_active', table_name='service_type_target_items', postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.drop_index(op.f('ix_service_type_target_items_service_type_target_id'), table_name='service_type_target_items')
    op.drop_index(op.f('ix_service_type_target_items_service_type_id'), table_name='service_type_target_items')
    op.drop_table('service_type_target_items')
    op.drop_index('uq_district_targets_target_district_active', table_name='district_targets', postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.drop_index(op.f('ix_district_targets_service_type_target_id'), table_name='district_targets')
    op.drop_index(op.f('ix_district_targets_district_id'), table_name='district_targets')
    op.drop_table('district_targets')
    op.drop_index(op.f('ix_service_type_targets_end_date'), table_name='service_type_targets')
    op.drop_index(op.f('ix_service_type_targets_start_date'), table_name='service_type_targets')
    op.drop_table('service_type_targets')