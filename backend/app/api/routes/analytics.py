import csv
import io
import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.datasets import Dataset
from app.models import AgentTransaction, CustomerRegistration, CustomerUpgrade
from app.schemas.agent_data import Page, RegistrationRead, TransactionRead, UpgradeRead
from app.services import analytics as svc
from app.services.analytics import DataFilters

router = APIRouter(tags=["analytics"])


def data_filters(
    date_from: date | None = None,
    date_to: date | None = None,
    agent_shortcode: str | None = None,
    region: str | None = None,
    district_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
    batch_id: uuid.UUID | None = None,
    service_type: str | None = None,
    channel: str | None = None,
    status_: str | None = Query(None, alias="status"),
    before_level: str | None = None,
    after_level: str | None = None,
    min_amount: Decimal | None = Query(None, ge=0),
    max_amount: Decimal | None = Query(None, ge=0),
    q: str | None = Query(None, max_length=100, description="Search organization name or short code"),
    fsp_id: uuid.UUID | None = None,
    district: str | None = None,
) -> DataFilters:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "date_from must be on or before date_to")
    return DataFilters(
        date_from=date_from, date_to=date_to, agent_shortcode=agent_shortcode, region=region,
        district_id=district_id, branch_id=branch_id, batch_id=batch_id, service_type=service_type,
        channel=channel, status=status_, before_level=before_level, after_level=after_level,
        min_amount=min_amount, max_amount=max_amount, q=q,fsp_id=fsp_id, district=district,
    )


Filters = Annotated[DataFilters, Depends(data_filters)]
Order = Literal["asc", "desc"]


# ------------------------------------------------------------------ advanced list queries
def _page(ds: Dataset, db, f, sort, order, skip, limit) -> dict:
    items, total = svc.list_rows(db, ds, f, sort=sort, order=order, skip=skip, limit=limit)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/data/transactions", response_model=Page[TransactionRead])
def list_transactions(
    db: DbSession, _: CurrentUser, f: Filters, sort: str | None = None, order: Order = "desc",
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
):
    return _page(Dataset.TRANSACTIONS, db, f, sort, order, skip, limit)


@router.get("/data/registrations", response_model=Page[RegistrationRead])
def list_registrations(
    db: DbSession, _: CurrentUser, f: Filters, sort: str | None = None, order: Order = "desc",
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
):
    return _page(Dataset.REGISTRATIONS, db, f, sort, order, skip, limit)


@router.get("/data/upgrades", response_model=Page[UpgradeRead])
def list_upgrades(
    db: DbSession, _: CurrentUser, f: Filters, sort: str | None = None, order: Order = "desc",
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
):
    return _page(Dataset.UPGRADES, db, f, sort, order, skip, limit)


# ------------------------------------------------------------------ dashboard
@router.get("/analytics/filters")
def filter_options(db: DbSession, _: CurrentUser) -> dict[str, list[str]]:
    """Distinct values for the filter dropdowns."""
    return svc.filter_options(db)


@router.get("/analytics/overview")
def overview(db: DbSession, _: CurrentUser, f: Filters):
    """KPI cards for all three datasets, each with the previous equal-length period for % change."""
    return svc.overview(db, f)


@router.get("/analytics/{dataset}/timeseries")
def timeseries(
    dataset: Dataset, db: DbSession, _: CurrentUser, f: Filters,
    interval: Literal["day", "week", "month"] = "day", group_by: str | None = None,
):
    if group_by and group_by not in svc.valid_dimensions(dataset):
        raise HTTPException(422, f"group_by must be one of {list(svc.valid_dimensions(dataset))}")
    return svc.timeseries(db, dataset, f, interval=interval, group_by=group_by)

@router.get("/analytics/{dataset}/summary")
def dataset_summary(dataset: Dataset, db: DbSession, _: CurrentUser, f: Filters):
    """KPI box values for one dataset, with the previous equal-length period for % change."""
    return svc.summary_with_previous(db, dataset, f)


@router.get("/analytics/{dataset}/breakdown")
def breakdown(
    dataset: Dataset, db: DbSession, _: CurrentUser, f: Filters,
    dimension: str = "agent", limit: int = Query(20, ge=1, le=200),
):
    if dimension not in svc.valid_dimensions(dataset):
        raise HTTPException(422, f"dimension must be one of {list(svc.valid_dimensions(dataset))}")
    return svc.breakdown(db, dataset, f, dimension=dimension, limit=limit)


# ------------------------------------------------------------------ exports (CSV, Excel-friendly)
def _csv_response(name: str, headers: list[str], rows: list[tuple | list]) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    return Response(
        content=buf.getvalue().encode("utf-8-sig"),  # BOM so Excel reads UTF-8 correctly
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}.csv"'},
    )


def _stem(dataset: Dataset, f: DataFilters, suffix: str = "") -> str:
    span = f"{f.date_from or 'start'}_{f.date_to or 'today'}"
    return f"{dataset.value}{suffix}_{span}"


@router.get("/data/{dataset}/export")
def export_rows(dataset: Dataset, db: DbSession, _: CurrentUser, f: Filters):
    """Every row matching the filters, with branch and district names added."""
    headers, rows, truncated = svc.export_rows(db, dataset, f)
    if truncated:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"More than {svc.MAX_EXPORT_ROWS:,} rows match; narrow the date range or filters",
        )
    return _csv_response(_stem(dataset, f), headers, rows)


@router.get("/analytics/{dataset}/breakdown/export")
def export_breakdown(
    dataset: Dataset, db: DbSession, _: CurrentUser, f: Filters, dimension: str = "agent",
):
    if dimension not in svc.valid_dimensions(dataset):
        raise HTTPException(422, f"dimension must be one of {list(svc.valid_dimensions(dataset))}")
    data = svc.breakdown(db, dataset, f, dimension=dimension, limit=10_000)
    headers = list(data[0].keys()) if data else ["key", "label"]
    return _csv_response(_stem(dataset, f, f"_by_{dimension}"), headers, [list(r.values()) for r in data])