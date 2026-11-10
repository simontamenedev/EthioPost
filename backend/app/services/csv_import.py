"""CSV ingestion for the three agent-monitoring reports.

Flow: validate headers -> parse/clean every row -> hash rows (idempotency) ->
skip rows already imported for this provider -> resolve agent_id from the agents
master data -> bulk insert under one ImportBatch -> commit. Nothing is written
if anything unexpected fails.

Every import belongs to one financial service provider (fsp_id): Telebirr, CBE, ...
"""
from __future__ import annotations

import hashlib
import io
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Callable

import pandas as pd
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.datasets import Dataset
from app.core.enums import AuditAction
from app.crud.audit import record_audit, snapshot
from app.models import (
    Agent,
    AgentTransaction,
    Branch,
    CustomerRegistration,
    CustomerUpgrade,
    District,
    ImportBatch,
)
from app.services import file_store
from app.services.commission import apply_commission

MAX_ERRORS = 50
CHUNK = 1000
CUSTOMER = "CUSTOMER"
UNASSIGNED = "Unassigned"  # fallback when a row has no region / organization

# Set to False if the `agents` table has NO fsp_id column (agent short codes are global).
AGENTS_HAVE_FSP = False


class CsvFormatError(ValueError):
    """The file is not a valid report of the requested type (HTTP 422)."""


class DuplicateFileError(ValueError):
    """This exact file was already imported (HTTP 409)."""


# --------------------------------------------------------------------------- cleaning
def _text(v: Any) -> str:
    return " ".join(str(v).split())  # trims and collapses the stray double spaces in org names


def _date(v: str) -> date:
    v = v.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):  # registrations/upgrades are ISO, transactions are M/D/YYYY
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"unrecognised date '{v}'")


def _count(v: str, field: str) -> int:
    try:
        n = int(Decimal(v.strip().replace(",", "")))
    except (InvalidOperation, ValueError):
        raise ValueError(f"{field} is not a number: '{v}'")
    if n < 0:
        raise ValueError(f"{field} cannot be negative")
    return n


def _money(v: str) -> Decimal:
    try:
        return Decimal(v.strip().replace(",", "")).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise ValueError(f"Total Amount is not a number: '{v}'")


def _region(v: str) -> str | None:
    return _text(v) or None


# --------------------------------------------------------------------------- row parsers
def _parse_transaction(r: dict[str, str]) -> dict[str, Any]:
    service = _text(r["Service Type"])
    debit, credit = _text(r["Debit short code"]), _text(r["Credit short code"])
    # Cash Out money flows customer -> agent, so the agent is the credit side.
    # Cash In / Airtime / Bill Payment: the agent is the debit side.
    agent = credit if service.lower() == "cash out" else debit
    if not agent or agent.upper() == CUSTOMER:
        raise ValueError(f"cannot determine agent short code for '{service}'")
    failure = _text(r["Failure Reason"])
    return dict(
        txn_date=_date(r["Date"]),
        agent_shortcode=agent,
        organization_name=_text(r["Organization"]),
        region=_region(r["ET Region"]),
        service_type=service,
        channel=_text(r["Channel"]).upper(),
        txn_status=_text(r["Status"]).upper(),
        debit_shortcode=debit,
        credit_shortcode=credit,
        txn_count=_count(r["Txn Count"], "Txn Count"),
        total_amount=_money(r["Total Amount"]),
        failure_reason=None if failure in ("", "-") else failure,
    )


def _parse_registration(r: dict[str, str]) -> dict[str, Any]:
    return dict(
        reg_date=_date(r["Date"]),
        agent_shortcode=_text(r["Short Code"]),
        organization_name=_text(r["Organization"]),
        region=_region(r["ET Region"]),
        customer_status=_text(r["Status"]),
        registration_count=_count(r["Registration Count"], "Registration Count"),
    )


def _parse_upgrade(r: dict[str, str]) -> dict[str, Any]:
    return dict(
        upgrade_date=_date(r["Date"]),
        agent_shortcode=_text(r["Short Code"]),
        organization_name=_text(r["Organization"]),
        region=_region(r["ET Region"]),
        upgrade_at=_text(r["Upgrade At"]),
        before_level=_text(r["Before Level"]),
        after_level=_text(r["After Level"]),
        upgrade_count=_count(r["Upgrade Count"], "Upgrade Count"),
    )


@dataclass(frozen=True)
class Spec:
    model: type
    date_field: str
    headers: tuple[str, ...]
    parse: Callable[[dict[str, str]], dict[str, Any]]


SPECS: dict[Dataset, Spec] = {
    Dataset.TRANSACTIONS: Spec(
        AgentTransaction, "txn_date",
        ("Date", "Organization", "Debit short code", "Credit short code", "ET Region",
         "Service Type", "Channel", "Status", "Txn Count", "Total Amount", "Failure Reason"),
        _parse_transaction,
    ),
    Dataset.REGISTRATIONS: Spec(
        CustomerRegistration, "reg_date",
        ("Date", "Organization", "Short Code", "ET Region", "Status", "Registration Count"),
        _parse_registration,
    ),
    Dataset.UPGRADES: Spec(
        CustomerUpgrade, "upgrade_date",
        ("Date", "Organization", "Short Code", "ET Region", "Upgrade At",
         "Before Level", "After Level", "Upgrade Count"),
        _parse_upgrade,
    ),
}


# --------------------------------------------------------------------------- import
def _digest(values: dict[str, Any]) -> str:
    return hashlib.sha256(repr(sorted(values.items())).encode()).hexdigest()


def _agent_map(db: Session, fsp_id: uuid.UUID) -> dict[str, uuid.UUID]:
    stmt = select(Agent.agent_shortcode, Agent.id).where(Agent.deleted_at.is_(None))
    if AGENTS_HAVE_FSP:
        stmt = stmt.where(Agent.fsp_id == fsp_id)
    return {code: agent_id for code, agent_id in db.execute(stmt).all()}


def import_csv(
    db: Session,
    *,
    fsp_id: uuid.UUID,
    dataset: Dataset,
    filename: str,
    content: bytes,
    actor_id: uuid.UUID,
) -> ImportBatch:
    spec = SPECS[dataset]
    model = spec.model

    file_hash = hashlib.sha256(content).hexdigest()
    already = db.scalar(
        select(ImportBatch.id).where(
            ImportBatch.fsp_id == fsp_id,
            ImportBatch.dataset == dataset,
            ImportBatch.file_hash == file_hash,
            ImportBatch.deleted_at.is_(None),
        )
    )
    if already:
        raise DuplicateFileError("This exact file has already been imported for this provider")

    try:
        df = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False, encoding="utf-8-sig")
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as exc:
        raise CsvFormatError(f"Could not read CSV: {exc}")
    df.columns = [str(c).strip() for c in df.columns]
    missing = [h for h in spec.headers if h not in df.columns]
    if missing:
        raise CsvFormatError(
            f"This does not look like a {dataset.value} file. Missing columns: {', '.join(missing)}"
        )
    if df.empty:
        raise CsvFormatError("The file has no data rows")

    parsed: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    invalid = 0
    occurrences: Counter[str] = Counter()
    for line, rec in enumerate(df.to_dict("records"), start=2):  # line 1 is the header
        try:
            values = spec.parse(rec)
        except (ValueError, KeyError) as exc:
            invalid += 1
            if len(errors) < MAX_ERRORS:
                errors.append({"line": line, "error": str(exc)})
            continue
        digest = _digest(values)
        n = occurrences[digest]  # identical rows inside one file are legitimate; number them
        occurrences[digest] += 1
        values["row_hash"] = hashlib.sha256(f"{dataset.value}:{digest}#{n}".encode()).hexdigest()
        parsed.append(values)

    hashes = [v["row_hash"] for v in parsed]
    existing: set[str] = set()
    for i in range(0, len(hashes), CHUNK):
        existing.update(
            db.scalars(
                select(model.row_hash).where(
                    model.fsp_id == fsp_id,
                    model.row_hash.in_(hashes[i : i + CHUNK]),
                    model.deleted_at.is_(None),
                )
            )
        )
    fresh = [v for v in parsed if v["row_hash"] not in existing]

       # Snapshot the FSP rule + agent split in force right now, for every dataset.
    # Runs after row_hash is computed, so a rule/rate change never alters row identity.
    apply_commission(db, dataset, fsp_id, fresh)

    agents = _agent_map(db, fsp_id)
    unmatched_codes = sorted({v["agent_shortcode"] for v in fresh if v["agent_shortcode"] not in agents})
    unmatched_rows = sum(1 for v in fresh if v["agent_shortcode"] not in agents)
    dates = [v[spec.date_field] for v in parsed]

    batch: ImportBatch | None = None
    batch_id: uuid.UUID | None = None
    try:
        batch = ImportBatch(
            fsp_id=fsp_id,
            dataset=dataset,
            filename=filename[:255],
            file_hash=file_hash,
            date_from=min(dates) if dates else None,
            date_to=max(dates) if dates else None,
            rows_total=len(df),
            rows_imported=len(fresh),
            rows_duplicate=len(parsed) - len(fresh),
            rows_invalid=invalid,
            rows_unmatched=unmatched_rows,
            unmatched_shortcodes=unmatched_codes[:200] or None,
            errors=errors or None,
            created_by=actor_id,
            updated_by=actor_id,
        )
        db.add(batch)
        db.flush()
        db.refresh(batch)
        batch_id = batch.id  # keep a plain copy: the ORM object is unusable after rollback
        file_store.save(batch_id, content)
        record_audit(db, action=AuditAction.CREATE, obj=batch, actor_id=actor_id, new_values=snapshot(batch))

        for i in range(0, len(fresh), CHUNK):
            db.add_all(
                model(
                    **v,
                    fsp_id=fsp_id,
                    agent_id=agents.get(v["agent_shortcode"]),
                    import_batch_id=batch_id,
                    created_by=actor_id,
                    updated_by=actor_id,
                )
                for v in fresh[i : i + CHUNK]
            )
            db.flush()
        db.commit()
    except Exception:
        db.rollback()
        if batch_id:
            file_store.remove(batch_id)  # don't leave an orphan file for a batch that never committed
        raise
    db.refresh(batch)
    return batch


# --------------------------------------------------------------------------- relink
def _stage_create(db: Session, model: type, data: dict[str, Any], actor_id: uuid.UUID):
    """Add + audit a new master-data row without committing (the caller commits once)."""
    obj = model(**data, created_by=actor_id, updated_by=actor_id)
    db.add(obj)
    db.flush()
    db.refresh(obj)
    record_audit(db, action=AuditAction.CREATE, obj=obj, actor_id=actor_id, new_values=snapshot(obj))
    return obj


def _orphan_locations(
    db: Session, known: dict[str, uuid.UUID], fsp_id: uuid.UUID
) -> dict[str, tuple[str, str]]:
    """agent_shortcode -> (region, organization) for this provider's imported rows whose agent
    doesn't exist yet. If a code appears under several organizations, the most frequent one wins."""
    best: dict[str, tuple[int, str, str]] = {}
    for spec in SPECS.values():
        m = spec.model
        rows = db.execute(
            select(m.agent_shortcode, m.region, m.organization_name, func.count())
            .where(m.fsp_id == fsp_id, m.agent_id.is_(None), m.deleted_at.is_(None))
            .group_by(m.agent_shortcode, m.region, m.organization_name)
        ).all()
        for code, region, org, n in rows:
            if code in known:
                continue
            if code not in best or n > best[code][0]:
                best[code] = (n, region or UNASSIGNED, org or UNASSIGNED)
    return {code: (region, org) for code, (_, region, org) in best.items()}


def relink_agents(
    db: Session, *, actor_id: uuid.UUID, fsp_id: uuid.UUID
) -> dict[str, dict[str, int]]:
    """Link one provider's imported rows to agents. Agents, branches (organizations) and
    districts (regions) that don't exist yet are created first. Everything commits together
    or not at all."""
    created = {"districts": 0, "branches": 0, "agents": 0}
    linked: dict[str, int] = {}
    try:
        agents = _agent_map(db, fsp_id)
        orphans = _orphan_locations(db, agents, fsp_id)

        if orphans:
            districts = {
                d.name.lower(): d.id
                for d in db.scalars(select(District).where(District.deleted_at.is_(None)))
            }
            branches = {
                (b.district_id, b.name.lower()): b.id
                for b in db.scalars(select(Branch).where(Branch.deleted_at.is_(None)))
            }

            for code, (region, org) in sorted(orphans.items()):
                district_id = districts.get(region.lower())
                if district_id is None:
                    district_id = _stage_create(
                        db, District,
                        {"name": region, "description": "Created from imported data"}, actor_id,
                    ).id
                    districts[region.lower()] = district_id
                    created["districts"] += 1

                branch_id = branches.get((district_id, org.lower()))
                if branch_id is None:
                    branch_id = _stage_create(
                        db, Branch,
                        {"name": org, "district_id": district_id,
                         "description": "Created from imported data"},
                        actor_id,
                    ).id
                    branches[(district_id, org.lower())] = branch_id
                    created["branches"] += 1

                agent_data = {
                    "agent_shortcode": code,
                    "agent_name": code,  # reports carry no agent name; edit it later
                    "branch_id": branch_id,
                    "district_id": district_id,
                    "remark": "Auto-created from imported data",
                }
                if AGENTS_HAVE_FSP:
                    agent_data["fsp_id"] = fsp_id
                agents[code] = _stage_create(db, Agent, agent_data, actor_id).id
                created["agents"] += 1

        for ds, spec in SPECS.items():
            model, total = spec.model, 0
            codes = db.scalars(
                select(model.agent_shortcode)
                .where(model.fsp_id == fsp_id, model.agent_id.is_(None), model.deleted_at.is_(None))
                .distinct()
            ).all()
            for code in codes:
                if code in agents:
                    res = db.execute(
                        update(model)
                        .where(
                            model.fsp_id == fsp_id,
                            model.agent_shortcode == code,
                            model.agent_id.is_(None),
                        )
                        .values(agent_id=agents[code])
                    )
                    total += res.rowcount or 0
            linked[ds.value] = total
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"linked": linked, "created": created}