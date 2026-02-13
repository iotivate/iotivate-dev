import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(subject: str, body: str, to_email: str | None = None) -> None:
    """Send an email via SMTP. Raises on failure.

    If to_email is not provided, falls back to the configured smtp_to_email
    (admin notification address).
    """
    if not settings.smtp_configured:
        logger.debug("SMTP not configured, skipping email send")
        return

    recipient = to_email or settings.smtp_to_email
    from_addr = settings.smtp_from_email or settings.smtp_user

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = recipient

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        if settings.smtp_use_tls:
            server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(from_addr, [recipient], msg.as_string())


def send_contact_notification(name: str, email: str, message: str) -> None:
    """Send admin notification for a new contact form submission. Never raises."""
    try:
        subject = f"[iotivate] New contact message from {name}"
        body = (
            f"New contact form submission:\n\n"
            f"Name:    {name}\n"
            f"Email:   {email}\n\n"
            f"Message:\n{message}\n"
        )
        send_email(subject, body)
    except Exception:
        logger.exception("Failed to send contact notification email")


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """Send a password reset link to the user. Never raises."""
    try:
        subject = "[iotivate] Password reset request"
        body = (
            f"You requested a password reset for your iotivate.dev account.\n\n"
            f"Click the link below to set a new password:\n\n"
            f"{reset_url}\n\n"
            f"This link expires in 15 minutes. If you did not request this, "
            f"you can safely ignore this email.\n"
        )
        send_email(subject, body, to_email=to_email)
    except Exception:
        logger.exception("Failed to send password reset email")
