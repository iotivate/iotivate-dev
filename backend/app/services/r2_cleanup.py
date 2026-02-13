import json
import logging
from urllib.parse import urlparse

from app.config import settings

logger = logging.getLogger(__name__)


def extract_r2_urls_from_project(project) -> list[str]:
    """Extract all R2 file URLs from a project's JSON fields."""
    if not settings.r2_public_url:
        return []

    urls: list[str] = []
    json_fields = [
        project.downloads_json,
        project.circuit_json,
        project.firmware_json,
        project.app_json,
    ]

    for raw in json_fields:
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        _collect_urls(data, urls)

    return urls


def _collect_urls(data, urls: list[str]) -> None:
    """Recursively find string values that match the R2 public URL."""
    if isinstance(data, str):
        if data.startswith(settings.r2_public_url):
            urls.append(data)
    elif isinstance(data, dict):
        for value in data.values():
            _collect_urls(value, urls)
    elif isinstance(data, list):
        for item in data:
            _collect_urls(item, urls)


def delete_r2_objects(urls: list[str], r2_client=None) -> int:
    """Delete R2 objects for the given URLs. Best-effort with logging.

    Returns the number of successfully deleted objects.
    """
    if not urls:
        return 0

    if r2_client is None:
        from app.api.upload import get_r2_client
        r2_client = get_r2_client()

    if r2_client is None:
        logger.warning("R2 not configured, skipping cleanup of %d file(s)", len(urls))
        return 0

    deleted = 0
    for url in urls:
        parsed = urlparse(url)
        # The key is the path without the leading slash
        key = parsed.path.lstrip("/")
        if not key:
            continue
        try:
            r2_client.delete_object(Bucket=settings.r2_bucket_name, Key=key)
            deleted += 1
            logger.info("Deleted R2 object: %s", key)
        except Exception:
            logger.exception("Failed to delete R2 object: %s", key)

    return deleted
