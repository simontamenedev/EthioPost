"""CSV ingestion for the three agent-monitoring reports.

Flow: validate headers -> skip blank rows -> parse/clean every row -> hash rows (idempotency) ->
skip rows already imported for this provider -> resolve agent_id from the agents
master data -> bulk insert under one ImportBatch -> commit. Nothing is written
if anything unexpected fails.

Every import belongs to one financial service provider (fsp_id): Telebirr, CBE, ...

Relink: an agent's district is the Ethio Post district its ET region is aligned to
(see app/core/region_alignment.py). ET regions are NOT stored as districts.

Logging: INFO = each step and its counts, WARNING = data problems, DEBUG = per-row / per-agent detail.
"""
from __future__ import annotations

import hashlib
import io
import logging
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from time import perf_counter
from typing import Any, Callable

import pandas as pd
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.datasets import Dataset
from app.core.enums import AuditAction
from app.core.region_alignment import HQ_BY_DISTRICT, district_for_region
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

logger = logging.getLogger(__name__)

MAX_ERRORS = 50
CHUNK = 1000
CUSTOMER = "CUSTOMER"
UNASSIGNED = "Unassigned"  # fallback district when a row has no / an unknown ET region

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


def _is_blank(rec: dict[str, str]) -> bool:
    """Spreadsheet exports often end with thousands of empty rows (only a '-' filler)."""
    return all(str(v).strip() in ("", "-") for v in rec.values())


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
    started = perf_counter()
    spec = SPECS[dataset]
    model = spec.model
    tag = f"[import {dataset.value} {filename}]"

    logger.info("%s step 1/8 received: fsp=%s size=%d bytes by user=%s", tag, fsp_id, len(content), actor_id)

    # ---- 2. duplicate-file check
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
        logger.warning("%s step 2/8 rejected: identical file already imported as batch %s", tag, already)
        raise DuplicateFileError("This exact file has already been imported for this provider")
    logger.info("%s step 2/8 file is new (sha256=%s…)", tag, file_hash[:12])

    # ---- 3. read + validate headers
    try:
        df = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False, encoding="utf-8-sig")
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as exc:
        logger.error("%s step 3/8 unreadable CSV: %s", tag, exc)
        raise CsvFormatError(f"Could not read CSV: {exc}")
    df.columns = [str(c).strip() for c in df.columns]
    logger.info("%s step 3/8 read CSV: %d rows, columns=%s", tag, len(df), list(df.columns))
    missing = [h for h in spec.headers if h not in df.columns]
    if missing:
        logger.error("%s step 3/8 wrong file type, missing columns: %s", tag, missing)
        raise CsvFormatError(
            f"This does not look like a {dataset.value} file. Missing columns: {', '.join(missing)}"
        )
    if df.empty:
        raise CsvFormatError("The file has no data rows")

    # ---- 4. parse + clean every row
    parsed: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    invalid = blank = 0
    occurrences: Counter[str] = Counter()
    for line, rec in enumerate(df.to_dict("records"), start=2):  # line 1 is the header
        if _is_blank(rec):
            blank += 1
            continue
        try:
            values = spec.parse(rec)
        except (ValueError, KeyError) as exc:
            invalid += 1
            logger.debug("%s line %d invalid: %s", tag, line, exc)
            if len(errors) < MAX_ERRORS:
                errors.append({"line": line, "error": str(exc)})
            continue
        digest = _digest(values)
        n = occurrences[digest]  # identical rows inside one file are legitimate; number them
        occurrences[digest] += 1
        values["row_hash"] = hashlib.sha256(f"{dataset.value}:{digest}#{n}".encode()).hexdigest()
        parsed.append(values)
        logger.debug(
            "%s line %d ok: agent=%s region=%s org=%s",
            tag, line, values["agent_shortcode"], values["region"], values["organization_name"],
        )
    logger.info("%s step 4/8 parsed: %d valid, %d invalid, %d blank rows skipped", tag, len(parsed), invalid, blank)
    if blank:
        logger.info("%s   (blank rows are ignored and not counted in the totals)", tag)
    for e in errors[:10]:
        logger.warning("%s   line %d: %s", tag, e["line"], e["error"])
    if invalid > 10:
        logger.warning("%s   … %d invalid rows in total (first %d kept on the batch)", tag, invalid, len(errors))

    # ---- 5. row-level idempotency
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
    logger.info("%s step 5/8 dedupe: %d new, %d already imported earlier", tag, len(fresh), len(parsed) - len(fresh))

    # ---- 6. commission snapshot
    # Snapshot the FSP rule + agent split in force right now, for every dataset.
    # Runs after row_hash is computed, so a rule/rate change never alters row identity.
    apply_commission(db, dataset, fsp_id, fresh)
    logger.info("%s step 6/8 commission applied to %d rows", tag, len(fresh))

    # ---- 7. agent matching
    agents = _agent_map(db, fsp_id)
    unmatched_codes = sorted({v["agent_shortcode"] for v in fresh if v["agent_shortcode"] not in agents})
    unmatched_rows = sum(1 for v in fresh if v["agent_shortcode"] not in agents)
    dates = [v[spec.date_field] for v in parsed]
    logger.info(
        "%s step 7/8 agent match: %d known agents, %d rows matched, %d rows unmatched (%d distinct codes)",
        tag, len(agents), len(fresh) - unmatched_rows, unmatched_rows, len(unmatched_codes),
    )
    if unmatched_codes:
        logger.warning("%s   unmatched codes (run relink to create them): %s", tag, unmatched_codes[:20])

    # ---- 8. write
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
            rows_total=len(parsed) + invalid,  # blank rows are not data
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
        logger.info("%s step 8/8 batch %s created, original file stored", tag, batch_id)

        for i in range(0, len(fresh), CHUNK):
            chunk = fresh[i : i + CHUNK]
            db.add_all(
                model(
                    **v,
                    fsp_id=fsp_id,
                    agent_id=agents.get(v["agent_shortcode"]),
                    import_batch_id=batch_id,
                    created_by=actor_id,
                    updated_by=actor_id,
                )
                for v in chunk
            )
            db.flush()
            logger.info("%s   inserted rows %d-%d of %d", tag, i + 1, i + len(chunk), len(fresh))
        db.commit()
    except Exception:
        logger.exception("%s FAILED, rolling back (nothing was saved)", tag)
        db.rollback()
        if batch_id:
            file_store.remove(batch_id)  # don't leave an orphan file for a batch that never committed
        raise
    db.refresh(batch)
    logger.info("%s DONE in %.2fs: batch=%s imported=%d duplicate=%d invalid=%d unmatched=%d",
                tag, perf_counter() - started, batch_id, len(fresh), len(parsed) - len(fresh), invalid, unmatched_rows)
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
) -> dict[str, tuple[str | None, str]]:
    """agent_shortcode -> (ET region, organization) for this provider's imported rows whose agent
    doesn't exist yet. If a code appears under several regions/organizations, the most frequent wins."""
    best: dict[str, tuple[int, str | None, str]] = {}
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
                best[code] = (n, region, org or UNASSIGNED)
    return {code: (region, org) for code, (_, region, org) in best.items()}


def relink_agents(
    db: Session, *, actor_id: uuid.UUID, fsp_id: uuid.UUID
) -> dict[str, dict[str, int]]:
    """Link one provider's imported rows to agents.

    For every unknown agent code: ET region -> Ethio Post district (hardcoded alignment),
    organization -> branch under that district, then the agent is created. ET regions are not
    stored as districts. Unknown / blank regions go to the "Unassigned" district.
    Everything commits together or not at all."""
    started = perf_counter()
    tag = f"[relink fsp={fsp_id}]"
    created = {"districts": 0, "branches": 0, "agents": 0}
    linked: dict[str, int] = {}
    unmapped: Counter[str] = Counter()
    logger.info("%s step 1/4 start (by user=%s)", tag, actor_id)

    try:
        agents = _agent_map(db, fsp_id)
        orphans = _orphan_locations(db, agents, fsp_id)
        logger.info("%s step 2/4 %d known agents, %d new agent codes found in imported rows",
                    tag, len(agents), len(orphans))

        if orphans:
            districts = {
                d.name.lower(): d
                for d in db.scalars(select(District).where(District.deleted_at.is_(None)))
            }
            branches = {
                (b.district_id, b.name.lower()): b.id
                for b in db.scalars(select(Branch).where(Branch.deleted_at.is_(None)))
            }

            def district_for(region: str | None) -> District:
                name = district_for_region(region)
                if name is None:
                    unmapped[region or "(blank)"] += 1
                    name = UNASSIGNED
                district = districts.get(name.lower())
                if district is None:
                    hq = HQ_BY_DISTRICT.get(name)
                    district = _stage_create(
                        db, District,
                        {
                            "name": name,
                            "description": f"Ethio Post district (HQ: {hq})" if hq else "Created from imported data",
                        },
                        actor_id,
                    )
                    districts[name.lower()] = district
                    created["districts"] += 1
                    logger.info("%s   district created: %s", tag, name)
                return district

            for code, (region, org) in sorted(orphans.items()):
                district = district_for(region)

                branch_id = branches.get((district.id, org.lower()))
                if branch_id is None:
                    branch_id = _stage_create(
                        db, Branch,
                        {"name": org, "district_id": district.id, "description": "Created from imported data"},
                        actor_id,
                    ).id
                    branches[(district.id, org.lower())] = branch_id
                    created["branches"] += 1
                    logger.info("%s   branch created: %s (district %s)", tag, org, district.name)

                agent_data = {
                    "agent_shortcode": code,
                    "agent_name": code,  # reports carry no agent name; edit it later
                    "branch_id": branch_id,
                    "district_id": district.id,
                    "remark": "Auto-created from imported data",
                }
                if AGENTS_HAVE_FSP:
                    agent_data["fsp_id"] = fsp_id
                agents[code] = _stage_create(db, Agent, agent_data, actor_id).id
                created["agents"] += 1
                logger.debug("%s   agent %s: region=%s -> district=%s, branch=%s",
                             tag, code, region, district.name, org)

            for region, n in unmapped.items():
                logger.warning("%s   ET region %r is not in the alignment: %d agent(s) put in '%s'. "
                               "Add it to region_alignment.py.", tag, region, n, UNASSIGNED)
        logger.info("%s step 3/4 created: %s", tag, created)

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
            logger.info("%s step 4/4 linked %d %s rows", tag, total, ds.value)
        db.commit()
    except Exception:
        logger.exception("%s FAILED, rolling back (nothing was saved)", tag)
        db.rollback()
        raise
    logger.info("%s DONE in %.2fs: linked=%s created=%s", tag, perf_counter() - started, linked, created)
    return {"linked": linked, "created": created}
