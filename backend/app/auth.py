from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models.user import User

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # Increased from 15 to 60 minutes
REFRESH_TOKEN_EXPIRE_DAYS = 7
REMEMBER_ME_EXPIRE_DAYS = 30
RESET_TOKEN_EXPIRE_MINUTES = 15

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


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


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


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
