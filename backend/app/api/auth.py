import logging

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_session
from app.models.user import User
from app.config import settings
from app.schemas.auth import (
    ForgotPasswordRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
)
from app.auth import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    get_current_user,
    hash_password,
    verify_password,
    verify_refresh_token,
    verify_reset_token,
)
from app.services.email import send_password_reset_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, data: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(
        select(User).where((User.email == data.email) | (User.username == data.username))
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already registered",
        )

    try:
        user = User(
            email=data.email,
            username=data.username,
            hashed_password=hash_password(data.password),
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    except Exception:
        logger.exception("Failed to register user")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again.",
        )

    logger.info("User registered: %s", data.username)
    return user


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/auth",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.username == form.username)).first()

    # Always run password verification to prevent timing attacks that reveal user existence
    if user:
        password_valid = verify_password(form.password, user.hashed_password)
    else:
        # Hash a dummy password to keep response time constant
        verify_password(form.password, "$2b$12$000000000000000000000uGMzx1K3kGGBMRMGPfGLSS2gZWlOBa2")
        password_valid = False

    if not password_valid:
        logger.warning("Failed login attempt for username: %s", form.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    access_token = create_access_token({"sub": user.username})
    refresh_token = create_refresh_token(user)
    _set_refresh_cookie(response, refresh_token)
    logger.info("User logged in: %s", user.username)
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
def refresh(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    refresh_token: str | None = Cookie(default=None),
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )
    user = verify_refresh_token(refresh_token, session)
    new_access_token = create_access_token({"sub": user.username})
    new_refresh_token = create_refresh_token(user)
    _set_refresh_cookie(response, new_refresh_token)
    return TokenResponse(access_token=new_access_token)


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response):
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/auth",
    )
    return {"message": "Logged out"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    session: Session = Depends(get_session),
):
    """Send a password reset email. Always returns success to avoid leaking user existence."""
    user = session.exec(select(User).where(User.email == data.email)).first()
    if user:
        token = create_reset_token(user)
        reset_url = f"{settings.frontend_url}/reset-password?token={token}"
        send_password_reset_email(user.email, reset_url)
        logger.info("Password reset email sent for user: %s", user.username)
    else:
        logger.info("Password reset requested for non-existent email: %s", data.email)

    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    session: Session = Depends(get_session),
):
    """Reset a user's password using a valid reset token."""
    user = verify_reset_token(data.token, session)
    user.hashed_password = hash_password(data.password)
    session.add(user)
    session.commit()
    logger.info("Password reset successfully for user: %s", user.username)
    return {"message": "Password has been reset successfully."}


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        is_pro=user.is_pro,
    )
