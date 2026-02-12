import logging
import os
import re
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
import boto3
from botocore.config import Config
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.auth import get_admin_user
from app.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/upload", tags=["upload"])

# Allowed folder prefixes for uploads
ALLOWED_FOLDER_PREFIXES = ("projects", "apps", "firmware", "general")

# File type configurations
ALLOWED_EXTENSIONS = {
    "image": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
    "document": [".pdf"],
    "model": [".stl", ".obj", ".step", ".stp"],
    "archive": [".zip", ".rar", ".7z", ".tar", ".gz"],
    "firmware": [".bin", ".hex", ".elf"],
    "app": [".apk", ".ipa"],
}

ALL_ALLOWED = [ext for exts in ALLOWED_EXTENSIONS.values() for ext in exts]

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


def get_r2_client():
    """Create and return an R2 client."""
    if not settings.r2_configured:
        return None

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
    )


def get_file_category(filename: str) -> str:
    """Determine file category based on extension."""
    ext = os.path.splitext(filename)[1].lower()
    for category, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return category
    return "other"


@router.post("")
@limiter.limit("10/minute")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    folder: str = Form(default="general"),
    _: User = Depends(get_admin_user),
) -> dict:
    """
    Upload a file to Cloudflare R2.

    - folder: Subfolder to organize files (e.g., 'projects/smart-relay', 'apps')
    - Returns the public URL of the uploaded file
    """
    if not settings.r2_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="File storage not configured. Please set R2 credentials in .env"
        )

    # Sanitize folder: reject path traversal and restrict to allowed prefixes
    folder = folder.strip("/")
    if ".." in folder or "\\" in folder:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid folder path"
        )
    if folder and not folder.startswith(ALLOWED_FOLDER_PREFIXES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Folder must start with one of: {', '.join(ALLOWED_FOLDER_PREFIXES)}"
        )

    # Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALL_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(ALL_ALLOWED)}"
        )

    # Read file content
    content = await file.read()

    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    # Generate unique filename: strip dangerous characters, prevent overwrites
    raw_filename = file.filename or "file"
    safe_filename = re.sub(r"[^\w.\-]", "-", raw_filename).lower()
    name, extension = os.path.splitext(safe_filename)
    unique_id = uuid.uuid4().hex[:8]
    unique_filename = f"{name}-{unique_id}{extension}"

    # Build the full path
    object_key = f"{folder}/{unique_filename}" if folder else unique_filename

    # Determine content type
    content_type = file.content_type or "application/octet-stream"

    # Upload to R2
    try:
        client = get_r2_client()
        client.put_object(
            Bucket=settings.r2_bucket_name,
            Key=object_key,
            Body=content,
            ContentType=content_type,
        )
    except Exception as e:
        logger.exception("R2 upload failed for key=%s", object_key)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file"
        )

    # Build public URL
    if settings.r2_public_url:
        public_url = f"{settings.r2_public_url.rstrip('/')}/{object_key}"
    else:
        # Fallback to R2.dev URL (if public access enabled)
        public_url = f"https://{settings.r2_bucket_name}.{settings.r2_account_id}.r2.dev/{object_key}"

    return {
        "url": public_url,
        "filename": unique_filename,
        "size": len(content),
        "category": get_file_category(safe_filename),
    }


@router.delete("")
async def delete_file(
    url: str,
    _: User = Depends(get_admin_user),
) -> dict:
    """Delete a file from R2 by its URL."""
    if not settings.r2_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="File storage not configured"
        )

    # Extract object key from URL
    if settings.r2_public_url and url.startswith(settings.r2_public_url):
        object_key = url[len(settings.r2_public_url):].lstrip("/")
    else:
        # Try to extract from r2.dev URL
        parts = url.split(".r2.dev/")
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file URL"
            )
        object_key = parts[1]

    try:
        client = get_r2_client()
        client.delete_object(Bucket=settings.r2_bucket_name, Key=object_key)
    except Exception as e:
        logger.exception("R2 delete failed for key=%s", object_key)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete file"
        )

    return {"deleted": True, "url": url}
