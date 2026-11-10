import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Index, Integer, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import BaseEntity, active_unique_index


class AgentFactMixin:
    """Columns shared by every imported report row.

    fsp_id is the financial service provider (Telebirr, CBE, ...) the report belongs to.
    agent_shortcode is always stored (it is what the CSV carries). agent_id is
    resolved against `agents` at import time and stays NULL when the agent is not
    in master data yet; POST /imports/relink fills it in later.
    region is the CSV's "ET Region" (a telecom region code such as NAAZ / ER),
    a different hierarchy from districts/branches, so it is kept as text.
    """

    fsp_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("financial_service_providers.id"), index=True)
    agent_shortcode: Mapped[str] = mapped_column(String(50), index=True)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("agents.id"), index=True)
    organization_name: Mapped[str] = mapped_column(String(200))
    region: Mapped[str | None] = mapped_column(String(20), index=True)
    import_batch_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("import_batches.id"), index=True)
    # Content hash (+ occurrence number for identical rows) -> idempotent re-uploads.
    # Unique per provider: the same content may legitimately exist for two providers.
    row_hash: Mapped[str] = mapped_column(String(64))


class CommissionSnapshotMixin:
    """Commission as it was calculated at import time. Never recomputed.

    fsp_id (from AgentFactMixin) + commission_rule_id + commission_rate_id say WHICH
    rule/rate was used; the value columns say WHAT they were then. Rules and rates may
    be edited or closed later; these columns still show the original calculation.

    Example: amount 1000, FSP rule 2% -> fsp_commission_amount 20.00
             CommissionRate 50%       -> agent 10.00, Ethio Post 10.00
    """

    commission_rule_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("commission_rules.id"), index=True)
    commission_rate_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("commission_rates.id"), index=True)

    # --- FSP side (snapshot of commission_rules) ---
    fsp_commission_type: Mapped[str | None] = mapped_column(String(20))      # FLAT / PERCENT
    fsp_commission_basis: Mapped[str | None] = mapped_column(String(30))    # txn_amount / fee_collected
    fsp_commission_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    fsp_commission_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # --- split (snapshot of commission_rates) ---
    agent_commission_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))         # % of FSP commission
    agent_commission_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    ethiopost_commission_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # CALCULATED / NO_RULE / NO_AGENT_RATE / NEEDS_FEE / NO_BASE / NOT_ELIGIBLE
    commission_status: Mapped[str | None] = mapped_column(String(20), index=True)


class AgentTransaction(AgentFactMixin, CommissionSnapshotMixin, BaseEntity):
    __tablename__ = "agent_transactions"
    __table_args__ = (
        active_unique_index("uq_agent_transactions_fsp_row_hash_active", "fsp_id", "row_hash"),
        Index("ix_agent_transactions_fsp_date_service", "fsp_id", "txn_date", "service_type"),
        Index("ix_agent_transactions_fsp_agent_date", "fsp_id", "agent_shortcode", "txn_date"),
    )

    txn_date: Mapped[date] = mapped_column(Date, index=True)
    service_type: Mapped[str] = mapped_column(String(50), index=True)  # Cash In / Cash Out / Airtime Top Up / Bill Payment
    channel: Mapped[str] = mapped_column(String(20), index=True)  # API / USSD
    txn_status: Mapped[str] = mapped_column(String(30), index=True)  # COMPLETED / FAILED ...
    debit_shortcode: Mapped[str] = mapped_column(String(50))
    credit_shortcode: Mapped[str] = mapped_column(String(50))
    txn_count: Mapped[int] = mapped_column(Integer)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    failure_reason: Mapped[str | None] = mapped_column(String(255))


class CustomerRegistration(AgentFactMixin, CommissionSnapshotMixin, BaseEntity):
    __tablename__ = "customer_registrations"
    __table_args__ = (
        active_unique_index("uq_customer_registrations_fsp_row_hash_active", "fsp_id", "row_hash"),
        Index("ix_customer_registrations_fsp_agent_date", "fsp_id", "agent_shortcode", "reg_date"),
    )

    reg_date: Mapped[date] = mapped_column(Date, index=True)
    customer_status: Mapped[str] = mapped_column(String(30), index=True)  # New / Pending Active / Active
    registration_count: Mapped[int] = mapped_column(Integer)


class CustomerUpgrade(AgentFactMixin, CommissionSnapshotMixin, BaseEntity):
    __tablename__ = "customer_upgrades"
    __table_args__ = (
        active_unique_index("uq_customer_upgrades_fsp_row_hash_active", "fsp_id", "row_hash"),
        Index("ix_customer_upgrades_fsp_agent_date", "fsp_id", "agent_shortcode", "upgrade_date"),
    )

    upgrade_date: Mapped[date] = mapped_column(Date, index=True)
    upgrade_at: Mapped[str] = mapped_column(String(50))  # CSV "Upgrade At" (e.g. Agent)
    before_level: Mapped[str] = mapped_column(String(30), index=True)
    after_level: Mapped[str] = mapped_column(String(30), index=True)
    upgrade_count: Mapped[int] = mapped_column(Integer)