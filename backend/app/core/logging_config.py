import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parents[2] / "logs"   # backend/logs
LOG_DIR.mkdir(exist_ok=True)

def setup_logging() -> None:
    fmt = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")

    file_handler = RotatingFileHandler(
        LOG_DIR / "app.log", maxBytes=5_000_000, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(fmt)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not any(isinstance(h, RotatingFileHandler) for h in root.handlers):  # avoids duplicates on --reload
        root.addHandler(file_handler)

    # uvicorn's loggers don't propagate by default, so attach the file handler to them too
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        if file_handler not in lg.handlers:
            lg.addHandler(file_handler)