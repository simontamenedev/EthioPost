# app/models/commission_rule.py
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import CommissionBasis, CommissionType
from app.db.base_model import BaseEntity, enum_column
from app.models.financial_service_provider import FinancialServiceProvider
from app.models.service_type import ServiceType


class CommissionRule(BaseEntity):
    """One line of the commission structure: FSP x service type x amount band.

    Examples (from FSPs_Commission_Structure_260319.docx)
      Telebirr  | Cash Out | 101-500        | FLAT    | 5
      Telebirr  | Airtime  | no band        | PERCENT | 15  (txn_amount)
      Ahadu     | Cash In  | >5001          | PERCENT | 0.20 (txn_amount)
      CBE Birr  | Cash Out | registered cust| PERCENT | 75  (fee_collected), qualifier="registered customer"
      Telebirr  | Biller fee | qualifier="DSTV" | PERCENT | 0.2

    Amount band is [min_amount, max_amount] inclusive; max_amount NULL = open ended,
    both NULL = applies to any amount. Lines are never edited for history: to change a
    rate, close the old line (effective_to) and add a new one.
    """

    __tablename__ = "commission_rules"
    __table_args__ = (
        CheckConstraint("max_amount IS NULL OR min_amount IS NULL OR max_amount >= min_amount",
                        name="ck_commission_rules_band"),
        Index("ix_commission_rules_lookup", "fsp_id", "service_type_id", "effective_from"),
    )

    fsp_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("financial_service_providers.id"), index=True)
    service_type_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("service_types.id"), index=True)

    # Sub-case inside a service: "registered customer", "unregistered customer",
    # "sub-agent", biller name (EEU, DSTV...), "Ethio telecom bill" ...
    qualifier: Mapped[str | None] = mapped_column(String(100), index=True)

    min_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    commission_type: Mapped[CommissionType] = mapped_column(enum_column(CommissionType))
    basis: Mapped[CommissionBasis | None] = mapped_column(enum_column(CommissionBasis))  # PERCENT only
    # ETB when FLAT, percent when PERCENT (15 means 15%, 0.20 means 0.20%).
    rate: Mapped[Decimal] = mapped_column(Numeric(12, 4))

    # Rules that cannot be a number: milestones, minimum txn counts, 30/70 payout, 80:20 share ...
    conditions: Mapped[str | None] = mapped_column(Text)

    effective_from: Mapped[date] = mapped_column(Date, index=True)
    effective_to: Mapped[date | None] = mapped_column(Date)

    fsp: Mapped[FinancialServiceProvider] = relationship(foreign_keys=[fsp_id])
    service_type: Mapped[ServiceType] = relationship(foreign_keys=[service_type_id])