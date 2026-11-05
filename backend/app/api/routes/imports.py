import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import update

from app.api.deps import AdminUser, DbSession
from app.api.utils import conflict, get_or_404
from app.core.datasets import Dataset
from app.crud import import_batch_crud
from app.models import ImportBatch
from app.schemas.agent_data import ImportBatchRead
from app.services import csv_import
from app.services.analytics import SPECS
from fastapi.responses import FileResponse
from app.services import file_store
router = APIRouter(prefix="/imports", tags=["imports"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


@router.get("", response_model=list[ImportBatchRead])
def list_imports(
    db: DbSession,
    _: AdminUser,
    dataset: Dataset | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[ImportBatch]:
    conditions = [ImportBatch.dataset == dataset] if dataset else []
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
    dataset: Dataset = Form(...),
    file: UploadFile = File(...),
) -> ImportBatch:
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(422, "Please upload a .csv file")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is larger than 20 MB")
    try:
        return csv_import.import_csv(
            db, dataset=dataset, filename=file.filename or "upload.csv", content=content, actor_id=admin.id
        )
    except csv_import.DuplicateFileError as exc:
        raise conflict(str(exc))
    except csv_import.CsvFormatError as exc:
        raise HTTPException(422, str(exc))


@router.post("/relink")
def relink_agents(db: DbSession, admin: AdminUser) -> dict[str, dict[str, int]]:
    """Attach imported rows to agents, creating missing agents, branches and districts first."""
    return csv_import.relink_agents(db, actor_id=admin.id)


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