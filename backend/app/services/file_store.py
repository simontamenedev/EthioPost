import os
import uuid
from pathlib import Path

# Point this at a persistent volume in production (Docker volume, mounted disk, ...).
IMPORT_DIR = Path(os.getenv("IMPORT_STORAGE_DIR", "storage/imports"))


def path_for(batch_id: uuid.UUID) -> Path:
    return IMPORT_DIR / f"{batch_id}.csv"


def save(batch_id: uuid.UUID, content: bytes) -> None:
    IMPORT_DIR.mkdir(parents=True, exist_ok=True)
    target = path_for(batch_id)
    tmp = target.with_suffix(".tmp")
    tmp.write_bytes(content)
    tmp.replace(target)  # atomic: no half-written files


def remove(batch_id: uuid.UUID) -> None:
    path_for(batch_id).unlink(missing_ok=True)