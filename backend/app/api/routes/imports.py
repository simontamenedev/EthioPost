import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import update

from app.api.deps import AdminUser, DbSession
from app.api.utils import conflict, get_or_404
from app.core.datasets import Dataset
from app.crud import import_batch_crud
from app.crud import fsp_crud  # <- adjust to the name of your financial_service_providers crud
from app.models import ImportBatch
from app.schemas.agent_data import ImportBatchRead  # must now include fsp_id: uuid.UUID
from app.services import csv_import, file_store
from app.services.analytics import SPECS

router = APIRouter(prefix="/imports", tags=["imports"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


@router.get("", response_model=list[ImportBatchRead])
def list_imports(
    db: DbSession,
    _: AdminUser,
    fsp_id: uuid.UUID | None = None,
    dataset: Dataset | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),  # the explorer groups client-side, so allow more
) -> list[ImportBatch]:
    conditions = []
    if fsp_id:
        conditions.append(ImportBatch.fsp_id == fsp_id)
    if dataset:
        conditions.append(ImportBatch.dataset == dataset)
    return import_batch_crud.get_multi(db, *conditions, skip=skip, limit=limit)


@router.get("/{batch_id}/file")
def download_import(batch_id: uuid.UUID, db: DbSession, _: AdminUser) -> FileResponse:
    """The original CSV exactly as it was uploaded."""
    batch = get_or_404(import_batch_crud, db, batch_id, "Import")
    path = file_store.path_for(batch.id)
    if not path.is_file():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "The original file was not stored (it was uploaded before file storage was added). Upload it again.",
        )
    return FileResponse(path, media_type="text/csv", filename=batch.filename)


@router.post("", response_model=ImportBatchRead, status_code=status.HTTP_201_CREATED)
async def upload_csv(
    db: DbSession,
    admin: AdminUser,
    fsp_id: uuid.UUID = Form(...),
    dataset: Dataset = Form(...),
    file: UploadFile = File(...),
) -> ImportBatch:
    get_or_404(fsp_crud, db, fsp_id, "Service provider")
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(422, "Please upload a .csv file")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is larger than 20 MB")
    try:
        return csv_import.import_csv(
            db,
            fsp_id=fsp_id,
            dataset=dataset,
            filename=file.filename or "upload.csv",
            content=content,
            actor_id=admin.id,
        )
    except csv_import.DuplicateFileError as exc:
        raise conflict(str(exc))
    except csv_import.CsvFormatError as exc:
        raise HTTPException(422, str(exc))


@router.post("/relink")
def relink_agents(
    db: DbSession,
    admin: AdminUser,
    fsp_id: uuid.UUID = Query(...),
) -> dict[str, dict[str, int]]:
    """Attach one provider's imported rows to agents, creating missing agents, branches and districts first."""
    get_or_404(fsp_crud, db, fsp_id, "Service provider")
    return csv_import.relink_agents(db, actor_id=admin.id, fsp_id=fsp_id)


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_import(batch_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    """Roll back a whole upload: its rows are soft-deleted, so the file can be re-imported."""
    batch = get_or_404(import_batch_crud, db, batch_id, "Import")
    model = SPECS[batch.dataset].model
    db.execute(
        update(model)
        .where(model.import_batch_id == batch.id, model.deleted_at.is_(None))
        .values(deleted_at=datetime.now(UTC), deleted_by=admin.id)
    )
    import_batch_crud.soft_delete(db, batch, actor_id=admin.id)  # commits rows + batch together