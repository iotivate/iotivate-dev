import logging
import sys

from pythonjsonlogger.json import JsonFormatter


def setup_logging(log_level: str) -> None:
    """Configure centralized logging for the application."""
    level = getattr(logging, log_level.upper(), logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)

    # Remove any existing handlers to avoid duplicates
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    if level == logging.DEBUG:
        # Human-readable format for development
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    else:
        # Structured JSON for production (Docker/CloudWatch)
        formatter = JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
        )

    handler.setFormatter(formatter)
    root.addHandler(handler)

    # Align uvicorn loggers with our configuration
    for uvicorn_logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_logger = logging.getLogger(uvicorn_logger_name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True

    # Quiet noisy third-party loggers
    for noisy_logger in ("urllib3", "boto3", "botocore", "s3transfer"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)
