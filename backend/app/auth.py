import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models.device import Device, PAIRING_PAIRED
from app.models.user import User

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # Increased from 15 to 60 minutes
REFRESH_TOKEN_EXPIRE_DAYS = 7
REMEMBER_ME_EXPIRE_DAYS = 30
RESET_TOKEN_EXPIRE_MINUTES = 15

# Device tokens are opaque API keys of the form `did_<device_id>.<secret>`.
# Only the sha256 of <secret> is stored; the device_id prefix makes
# verification an indexed primary-key lookup instead of a table scan.
DEVICE_TOKEN_PREFIX = "did_"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
# Devices present their token as `Authorization: Bearer <token>`, same header
# as users; a separate scheme keeps the OpenAPI docs honest about which
# endpoints are device-authenticated.
device_token_scheme = OAuth2PasswordBearer(tokenUrl="/api/devices/pair", auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(user: User, remember: bool = False) -> str:
    days = REMEMBER_ME_EXPIRE_DAYS if remember else REFRESH_TOKEN_EXPIRE_DAYS
    expire = datetime.now(timezone.utc) + timedelta(days=days)
    return jwt.encode(
        {"sub": user.username, "purpose": "refresh", "rem": remember, "exp": expire},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def verify_refresh_token(token: str, session: Session) -> tuple[User, bool]:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("purpose") != "refresh":
            raise credentials_exc
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    remember: bool = payload.get("rem", False)
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exc
    return user, remember


def verify_access_token(token: str, session: Session) -> User:
    """Decode an access-token JWT and return the user, or raise 401.

    Factored out of get_current_user so non-HTTP entry points (e.g. the radar
    WebSocket, where the token arrives as a query param rather than a Bearer
    header) can authenticate a user the same way."""
    credentials_exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exc
    return user


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return verify_access_token(token, session)


def create_reset_token(user: User) -> str:
    """Create a short-lived JWT for password reset.

    Embeds a prefix of the current password hash so the token auto-invalidates
    once the password is changed (effectively single-use without DB storage).
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {
            "sub": user.username,
            "purpose": "password_reset",
            "phash": user.hashed_password[:16],
            "exp": expire,
        },
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def verify_reset_token(token: str, session: Session) -> User:
    """Decode a password-reset JWT and return the matching user.

    Raises HTTPException if the token is invalid, expired, already used,
    or the user no longer exists.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset token",
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("purpose") != "password_reset":
            raise credentials_exc
        username: str | None = payload.get("sub")
        phash: str | None = payload.get("phash")
        if username is None or phash is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exc

    # Verify the password hasn't changed since the token was issued
    if user.hashed_password[:16] != phash:
        raise credentials_exc

    return user


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def _hash_device_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def generate_device_token(device_id: int) -> tuple[str, str]:
    """Mint a device token. Returns (token, token_hash). The token is shown to
    the device exactly once; only the hash is persisted."""
    secret = secrets.token_urlsafe(32)
    token = f"{DEVICE_TOKEN_PREFIX}{device_id}.{secret}"
    return token, _hash_device_secret(secret)


def verify_device_token(token: str, session: Session) -> Device:
    """Resolve a device token to its paired Device, or raise 401."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid device token",
    )
    # Expected form: did_<device_id>.<secret>. token_urlsafe never emits ".",
    # so a single split cleanly separates the id-prefix from the secret.
    if not token or not token.startswith(DEVICE_TOKEN_PREFIX) or "." not in token:
        raise credentials_exc
    head, secret = token.split(".", 1)
    id_str = head[len(DEVICE_TOKEN_PREFIX):]
    if not id_str.isdigit():
        raise credentials_exc

    device = session.get(Device, int(id_str))
    if device is None or not device.device_token_hash or device.pairing_state != PAIRING_PAIRED:
        raise credentials_exc
    if not hmac.compare_digest(_hash_device_secret(secret), device.device_token_hash):
        raise credentials_exc
    return device


def get_current_device(
    token: str | None = Depends(device_token_scheme),
    session: Session = Depends(get_session),
) -> Device:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return verify_device_token(token, session)
