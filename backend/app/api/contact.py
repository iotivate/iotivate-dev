import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.database import get_session
from app.models.contact import ContactMessage
from app.schemas.contact import ContactRequest, ContactResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def submit_contact(
    data: ContactRequest, session: Session = Depends(get_session)
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
    return ContactResponse(status="ok", message="Message received. We'll get back to you.")
