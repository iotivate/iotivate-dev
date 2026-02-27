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


def delete_r2_folder(folder_path: str, r2_client=None) -> int:
    """Delete entire R2 folder and all its contents.

    Args:
        folder_path: Path like "projects/project-slug/" (with trailing slash)
        r2_client: Optional R2 client instance

    Returns the number of successfully deleted objects.
    """
    if r2_client is None:
        from app.api.upload import get_r2_client
        r2_client = get_r2_client()

    if r2_client is None:
        logger.warning("R2 not configured, skipping cleanup of folder: %s", folder_path)
        return 0

    if not folder_path.endswith('/'):
        folder_path = folder_path + '/'

    try:
        # List all objects with the folder prefix
        response = r2_client.list_objects_v2(
            Bucket=settings.r2_bucket_name,
            Prefix=folder_path
        )

        if 'Contents' not in response:
            logger.info("No objects found in folder: %s", folder_path)
            return 0

        # Delete all objects in the folder
        objects_to_delete = []
        for obj in response['Contents']:
            objects_to_delete.append({'Key': obj['Key']})

        if objects_to_delete:
            delete_response = r2_client.delete_objects(
                Bucket=settings.r2_bucket_name,
                Delete={'Objects': objects_to_delete}
            )

            deleted_count = len(delete_response.get('Deleted', []))
            failed_count = len(delete_response.get('Errors', []))

            if failed_count > 0:
                logger.warning("Failed to delete %d objects from folder: %s", failed_count, folder_path)

            logger.info("Successfully deleted %d objects from folder: %s", deleted_count, folder_path)
            return deleted_count

        return 0

    except Exception as e:
        logger.exception("Failed to delete folder: %s", folder_path)
        return 0
