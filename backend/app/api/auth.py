import logging
from datetime import datetime, timezone

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
    REMEMBER_ME_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    get_admin_user,
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


def _set_refresh_cookie(response: Response, token: str, remember: bool = False) -> None:
    kwargs: dict = dict(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/auth",
    )
    if remember:
        kwargs["max_age"] = REMEMBER_ME_EXPIRE_DAYS * 86400
    response.set_cookie(**kwargs)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    response: Response,
    remember_me: bool = False,
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
    refresh_token = create_refresh_token(user, remember=remember_me)
    _set_refresh_cookie(response, refresh_token, remember=remember_me)
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
    user, remember = verify_refresh_token(refresh_token, session)
    new_access_token = create_access_token({"sub": user.username})
    new_refresh_token = create_refresh_token(user, remember=remember)
    _set_refresh_cookie(response, new_refresh_token, remember=remember)
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


@router.get("/smtp-status")
def smtp_status(user: User = Depends(get_admin_user)):
    """Admin endpoint to check SMTP configuration status."""
    return {
        "smtp_configured": settings.smtp_configured,
        "smtp_host": settings.smtp_host or "(not set)",
        "smtp_port": settings.smtp_port,
        "smtp_user": settings.smtp_user or "(not set)",
        "smtp_password_set": bool(settings.smtp_password),
        "smtp_from_email": settings.smtp_from_email or "(not set)",
        "smtp_to_email": settings.smtp_to_email or "(not set)",
        "smtp_use_tls": settings.smtp_use_tls,
        "frontend_url": settings.frontend_url,
        "validation_errors": settings.smtp_validation_errors,
    }


@router.post("/test-email")
def test_email(
    data: dict,
    user: User = Depends(get_admin_user)
):
    """Admin endpoint to test email delivery."""
    test_email_addr = data.get("email") or user.email

    if not settings.smtp_configured:
        return {
            "success": False,
            "error": "SMTP not configured",
            "details": {
                "smtp_host": bool(settings.smtp_host),
                "smtp_user": bool(settings.smtp_user),
                "smtp_password": bool(settings.smtp_password),
                "smtp_to_email": bool(settings.smtp_to_email)
            }
        }

    try:
        from app.services.email import send_email
        send_email(
            subject="[iotivate] SMTP Test Email",
            body=f"This is a test email sent at {datetime.now(timezone.utc)}.\n\nIf you see this, SMTP is working correctly!",
            to_email=test_email_addr
        )
        logger.info("Test email sent successfully to %s", test_email_addr)
        return {
            "success": True,
            "message": f"Test email sent to {test_email_addr}"
        }
    except Exception as e:
        logger.exception("Test email failed")
        return {
            "success": False,
            "error": str(e),
            "type": type(e).__name__
        }
