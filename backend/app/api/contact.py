import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_session
from app.models.contact import ContactMessage
from app.schemas.contact import ContactRequest, ContactResponse
from app.services.email import send_contact_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contact", tags=["contact"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
def submit_contact(
    request: Request, data: ContactRequest, session: Session = Depends(get_session)
) -> ContactResponse:
    try:
        msg = ContactMessage(name=data.name, email=data.email, message=data.message)
        session.add(msg)
        session.commit()
    except Exception:
        logger.exception("Failed to save contact message")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save message. Please try again.",
        )

    send_contact_notification(data.name, data.email, data.message)

    return ContactResponse(status="ok", message="Message received. We'll get back to you.")
