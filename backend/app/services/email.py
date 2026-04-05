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
        logger.warning("SMTP not configured - missing required variables. Email not sent.")
        logger.debug("SMTP config status: host=%s, user=%s, password_set=%s, to_email=%s",
                    bool(settings.smtp_host), bool(settings.smtp_user),
                    bool(settings.smtp_password), bool(settings.smtp_to_email))
        return

    recipient = to_email or settings.smtp_to_email
    from_addr = settings.smtp_from_email or settings.smtp_user

    logger.info("Attempting to send email: %s -> %s (via %s:%s)", from_addr, recipient, settings.smtp_host, settings.smtp_port)

    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = recipient

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            logger.debug("SMTP connection established")
            if settings.smtp_use_tls:
                logger.debug("Starting TLS...")
                server.starttls()
            logger.debug("Authenticating with username: %s", settings.smtp_user)
            server.login(settings.smtp_user, settings.smtp_password)
            logger.debug("Authentication successful, sending email...")
            server.sendmail(from_addr, [recipient], msg.as_string())
            logger.info("Email sent successfully to %s", recipient)

    except smtplib.SMTPAuthenticationError as e:
        logger.error("SMTP Authentication failed - check Gmail app password: %s", e)
        raise
    except smtplib.SMTPRecipientsRefused as e:
        logger.error("SMTP recipients refused - invalid email address: %s", e)
        raise
    except smtplib.SMTPConnectError as e:
        logger.error("SMTP connection failed - check host/port: %s", e)
        raise
    except smtplib.SMTPException as e:
        logger.error("SMTP error occurred: %s", e)
        raise
    except Exception as e:
        logger.error("Unexpected error sending email: %s", e)
        raise


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
        logger.info("Sending password reset email to: %s", to_email)
        send_email(subject, body, to_email=to_email)
        logger.info("Password reset email sent successfully to: %s", to_email)
    except Exception as e:
        logger.error("Failed to send password reset email to %s: %s (%s)",
                    to_email, str(e), type(e).__name__)
        logger.exception("Full password reset email error details")
