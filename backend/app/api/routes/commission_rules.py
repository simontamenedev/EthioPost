# app/api/routes/commission_rules.py
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Query, status
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import bad_request, conflict, get_or_404
from app.core.enums import CommissionType, Status, UserRole
from app.crud import commission_rule_crud, fsp_crud, service_type_crud
from app.models import CommissionRule
from app.schemas.commission_rule import (
    CommissionRuleCreate, CommissionRuleDetail, CommissionRuleRead, CommissionRuleUpdate,
)
from app.services.audit_stamp import audit_stamp

router = APIRouter(prefix="/commission-rules", tags=["commission-rules"])

_LOADS = (selectinload(CommissionRule.fsp), selectinload(CommissionRule.service_type))
_FIELDS = (
    "fsp_id", "service_type_id", "qualifier", "min_amount", "max_amount", "commission_type",
    "basis", "rate", "effective_from", "effective_to", "status",
)
_NEG, _POS = Decimal("-1e18"), Decimal("1e18")


def _clean(data: dict) -> dict:
    if "qualifier" in data:
        data["qualifier"] = " ".join(data["qualifier"].split()) or None if data["qualifier"] else None
    if "conditions" in data and data["conditions"] is not None:
        data["conditions"] = data["conditions"].strip() or None
    return data


def _overlaps(a: dict, b) -> bool:
    """True when two rules cover the same band at the same time."""
    band = (a["min_amount"] if a["min_amount"] is not None else _NEG) <= (b.max_amount if b.max_amount is not None else _POS) \
        and (b.min_amount if b.min_amount is not None else _NEG) <= (a["max_amount"] if a["max_amount"] is not None else _POS)
    time = (a["effective_from"] <= (b.effective_to or date.max)) and (b.effective_from <= (a["effective_to"] or date.max))
    return band and time


def _validate(db, d: dict, exclude_id: uuid.UUID | None = None) -> None:
    """d is the full, merged rule. Raises 400/404/409."""
    if not fsp_crud.get(db, d["fsp_id"]):
        raise bad_request("Financial service provider not found")
    if not service_type_crud.get(db, d["service_type_id"]):
        raise bad_request("Service type not found")

    if d["commission_type"] is CommissionType.PERCENT:
        if d["basis"] is None:
            raise bad_request("A percentage rate needs a basis (what the percent is applied to)")
        if d["rate"] > 100:
            raise bad_request("A percentage rate cannot exceed 100")
    if d["min_amount"] is not None and d["max_amount"] is not None and d["max_amount"] < d["min_amount"]:
        raise bad_request("Maximum amount must be greater than or equal to the minimum amount")
    if d["effective_to"] is not None and d["effective_to"] < d["effective_from"]:
        raise bad_request("Effective-to date cannot be before the effective-from date")

    if d["status"] is Status.ACTIVE:
        same = [
            CommissionRule.fsp_id == d["fsp_id"],
            CommissionRule.service_type_id == d["service_type_id"],
            CommissionRule.status == Status.ACTIVE,
            CommissionRule.qualifier.is_(None) if d["qualifier"] is None else CommissionRule.qualifier == d["qualifier"],
        ]
        if exclude_id:
            same.append(CommissionRule.id != exclude_id)
        for other in commission_rule_crud.get_multi(db, *same, limit=200):
            if _overlaps(d, other):
                raise conflict(
                    "Another active rule for this provider, service and qualifier already covers "
                    "this amount band in this period. Close it (set effective-to) or change the band."
                )


@router.get("", response_model=list[CommissionRuleRead])
def list_commission_rules(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_: Status | None = Query(None, alias="status"),
    fsp_id: uuid.UUID | None = None,
    service_type_id: uuid.UUID | None = None,
    q: str | None = Query(None, description="Search qualifier or conditions"),
) -> list[CommissionRule]:
    conditions = []
    if status_:
        conditions.append(CommissionRule.status == status_)
    if fsp_id:
        conditions.append(CommissionRule.fsp_id == fsp_id)
    if service_type_id:
        conditions.append(CommissionRule.service_type_id == service_type_id)
    if q:
        like = f"%{q}%"
        conditions.append(CommissionRule.qualifier.ilike(like) | CommissionRule.conditions.ilike(like))
    return commission_rule_crud.get_multi(db, *conditions, skip=skip, limit=limit, options=_LOADS)


@router.get("/{rule_id}", response_model=CommissionRuleDetail)
def get_commission_rule(rule_id: uuid.UUID, db: DbSession, user: CurrentUser) -> CommissionRuleDetail:
    rule = get_or_404(commission_rule_crud, db, rule_id, "Commission rule")
    return CommissionRuleDetail.model_validate(rule).model_copy(update={
        "audit": audit_stamp(db, rule) if user.role == UserRole.ADMIN else None,
    })


@router.post("", response_model=CommissionRuleRead, status_code=status.HTTP_201_CREATED)
def create_commission_rule(payload: CommissionRuleCreate, db: DbSession, admin: AdminUser) -> CommissionRule:
    data = _clean(payload.model_dump())
    _validate(db, data)
    if data["commission_type"] is CommissionType.FLAT:
        data["basis"] = None
    return commission_rule_crud.create(db, data, actor_id=admin.id)


@router.patch("/{rule_id}", response_model=CommissionRuleRead)
def update_commission_rule(
    rule_id: uuid.UUID, payload: CommissionRuleUpdate, db: DbSession, admin: AdminUser
) -> CommissionRule:
    rule = get_or_404(commission_rule_crud, db, rule_id, "Commission rule")
    data = _clean(payload.model_dump(exclude_unset=True))
    merged = {k: getattr(rule, k) for k in _FIELDS} | {k: v for k, v in data.items() if k in _FIELDS}
    _validate(db, merged, exclude_id=rule.id)
    if merged["commission_type"] is CommissionType.FLAT and rule.basis is not None:
        data["basis"] = None
    return commission_rule_crud.update(db, rule, data, actor_id=admin.id)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commission_rule(rule_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    """Safe: transactions keep their own rate snapshot."""
    rule = get_or_404(commission_rule_crud, db, rule_id, "Commission rule")
    commission_rule_crud.soft_delete(db, rule, actor_id=admin.id)