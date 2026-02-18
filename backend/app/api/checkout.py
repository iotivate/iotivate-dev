import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from enum import Enum

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session, select

from app.auth import get_current_user
from app.config import settings
from app.database import get_session
from app.models.project import Project
from app.models.purchase import Purchase
from app.models.user import User
from app.models.webhook_event import WebhookEvent

logger = logging.getLogger(__name__)

router = APIRouter(tags=["checkout"])
limiter = Limiter(key_func=get_remote_address)

LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1"


class CheckoutRequest(BaseModel):
    project_slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")


class CheckoutResponse(BaseModel):
    url: str


class PurchaseStatusResponse(BaseModel):
    purchased: bool


class SubscriptionPlan(str, Enum):
    monthly = "monthly"
    yearly = "yearly"


class SubscribeRequest(BaseModel):
    plan: SubscriptionPlan


class SubscriptionStatusResponse(BaseModel):
    is_pro: bool
    subscription_status: str | None
    subscription_ends_at: str | None


class PortalResponse(BaseModel):
    url: str


@router.post("/checkout", response_model=CheckoutResponse)
@limiter.limit("5/minute")
def create_checkout(
    request: Request,
    data: CheckoutRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not settings.ls_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment processing is not configured",
        )

    project = session.exec(
        select(Project).where(Project.slug == data.project_slug)
    ).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if not project.firmware_json:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project has no firmware")

    firmware = json.loads(project.firmware_json)
    variant_id = firmware.get("variantId")
    price = firmware.get("price", 0)

    if not variant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firmware is not configured for purchase",
        )

    if price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firmware is free — no checkout needed",
        )

    # Check if already purchased
    existing = session.exec(
        select(Purchase).where(
            Purchase.user_id == user.id,
            Purchase.project_id == project.id,
            Purchase.status == "paid",
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already own this firmware",
        )

    # Create Lemon Squeezy checkout
    checkout_payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "custom_data": {
                    "user_id": str(user.id),
                    "project_slug": data.project_slug,
                },
                "checkout_data": {
                    "email": user.email,
                },
                "product_options": {
                    "redirect_url": f"{settings.cors_origin_list[0]}/projects/{data.project_slug}",
                },
            },
            "relationships": {
                "store": {
                    "data": {
                        "type": "stores",
                        "id": settings.lemonsqueezy_store_id,
                    }
                },
                "variant": {
                    "data": {
                        "type": "variants",
                        "id": variant_id,
                    }
                },
            },
        }
    }

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{LEMONSQUEEZY_API_BASE}/checkouts",
                json=checkout_payload,
                headers={
                    "Authorization": f"Bearer {settings.lemonsqueezy_api_key}",
                    "Accept": "application/vnd.api+json",
                    "Content-Type": "application/vnd.api+json",
                },
            )
    except httpx.RequestError as e:
        logger.error("Lemon Squeezy API request failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service unavailable",
        )

    if resp.status_code != 201:
        logger.error(
            "Lemon Squeezy checkout creation failed: %s %s",
            resp.status_code,
            resp.text[:500],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create checkout session",
        )

    checkout_data = resp.json()
    checkout_url = checkout_data["data"]["attributes"]["url"]

    return CheckoutResponse(url=checkout_url)


@router.post("/webhooks/lemonsqueezy", status_code=status.HTTP_200_OK)
async def lemonsqueezy_webhook(request: Request, session: Session = Depends(get_session)):
    if not settings.ls_configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

    # Read raw body for signature verification
    body = await request.body()

    # Verify HMAC-SHA256 signature
    signature = request.headers.get("X-Signature")
    if not signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing signature",
        )

    expected = hmac.new(
        settings.lemonsqueezy_webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )

    # Parse event
    event_name = request.headers.get("X-Event-Name", "")
    payload = json.loads(body)
    order_id = str(payload.get("data", {}).get("id", "")) or None

    # Log webhook event
    webhook_event = WebhookEvent(
        event_name=event_name,
        lemon_order_id=order_id,
        payload_json=body.decode("utf-8"),
        status="processed",
    )

    subscription_events = {
        "subscription_created",
        "subscription_updated",
        "subscription_cancelled",
        "subscription_resumed",
        "subscription_expired",
        "subscription_payment_failed",
    }

    try:
        if event_name == "order_created":
            _handle_order_created(payload, session)
        elif event_name == "order_refunded":
            _handle_order_refunded(payload, session)
        elif event_name in subscription_events:
            _handle_subscription_event(event_name, payload, session)
        else:
            webhook_event.status = "ignored"
            logger.info("Ignoring Lemon Squeezy event: %s", event_name)
    except Exception as e:
        webhook_event.status = "failed"
        webhook_event.error_message = str(e)[:2000]
        logger.exception("Webhook handler failed for event: %s", event_name)

    session.add(webhook_event)
    session.commit()

    return {"status": "ok"}


def _handle_order_created(payload: dict, session: Session) -> None:
    meta = payload.get("meta", {})
    custom_data = meta.get("custom_data", {})
    user_id_str = custom_data.get("user_id")
    project_slug = custom_data.get("project_slug")

    if not user_id_str or not project_slug:
        logger.warning("Webhook missing custom_data: %s", custom_data)
        return

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        logger.warning("Invalid user_id in webhook: %s", user_id_str)
        return

    attrs = payload.get("data", {}).get("attributes", {})
    order_id = str(payload.get("data", {}).get("id", ""))

    if not order_id:
        logger.warning("Webhook missing order ID")
        return

    # Idempotency: skip if already recorded
    existing = session.exec(
        select(Purchase).where(Purchase.lemon_order_id == order_id)
    ).first()
    if existing:
        logger.info("Duplicate webhook for order %s, skipping", order_id)
        return

    # Look up user and project
    user = session.get(User, user_id)
    if not user:
        logger.warning("Webhook user_id %s not found", user_id)
        return

    project = session.exec(
        select(Project).where(Project.slug == project_slug)
    ).first()
    if not project:
        logger.warning("Webhook project_slug %s not found", project_slug)
        return

    purchase = Purchase(
        user_id=user_id,
        project_id=project.id,  # type: ignore[arg-type]
        lemon_order_id=order_id,
        status="paid",
        amount=attrs.get("total", 0),
        currency=attrs.get("currency", "USD"),
        customer_email=attrs.get("user_email", user.email),
    )
    session.add(purchase)
    session.commit()
    logger.info("Purchase recorded: user=%s project=%s order=%s", user_id, project_slug, order_id)


def _handle_order_refunded(payload: dict, session: Session) -> None:
    order_id = str(payload.get("data", {}).get("id", ""))
    if not order_id:
        return

    purchase = session.exec(
        select(Purchase).where(Purchase.lemon_order_id == order_id)
    ).first()
    if purchase:
        purchase.status = "refunded"
        session.add(purchase)
        session.commit()
        logger.info("Purchase refunded: order=%s", order_id)


@router.get("/purchases/{slug}", response_model=PurchaseStatusResponse)
def check_purchase(
    slug: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    project = session.exec(
        select(Project).where(Project.slug == slug)
    ).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    purchase = session.exec(
        select(Purchase).where(
            Purchase.user_id == user.id,
            Purchase.project_id == project.id,
            Purchase.status == "paid",
        )
    ).first()

    return PurchaseStatusResponse(purchased=purchase is not None)


# --- Subscription endpoints ---


@router.post("/subscribe", response_model=CheckoutResponse)
@limiter.limit("5/minute")
def create_subscription_checkout(
    request: Request,
    data: SubscribeRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not settings.pro_subscription_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Subscription service is not configured",
        )

    if user.is_pro:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active Pro subscription",
        )

    variant_id = (
        settings.lemonsqueezy_pro_monthly_variant_id
        if data.plan == SubscriptionPlan.monthly
        else settings.lemonsqueezy_pro_yearly_variant_id
    )

    checkout_payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "custom_data": {
                    "user_id": str(user.id),
                    "checkout_type": "subscription",
                },
                "checkout_data": {
                    "email": user.email,
                },
                "product_options": {
                    "redirect_url": f"{settings.cors_origin_list[0]}/pro?success=true",
                },
            },
            "relationships": {
                "store": {
                    "data": {
                        "type": "stores",
                        "id": settings.lemonsqueezy_store_id,
                    }
                },
                "variant": {
                    "data": {
                        "type": "variants",
                        "id": variant_id,
                    }
                },
            },
        }
    }

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{LEMONSQUEEZY_API_BASE}/checkouts",
                json=checkout_payload,
                headers={
                    "Authorization": f"Bearer {settings.lemonsqueezy_api_key}",
                    "Accept": "application/vnd.api+json",
                    "Content-Type": "application/vnd.api+json",
                },
            )
    except httpx.RequestError as e:
        logger.error("Lemon Squeezy subscription checkout failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service unavailable",
        )

    if resp.status_code != 201:
        error_body = resp.text[:500]
        logger.error(
            "Lemon Squeezy subscription checkout failed: %s %s",
            resp.status_code,
            error_body,
        )
        # Include LS status for debugging; the full body stays in server logs only
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Checkout failed (upstream {resp.status_code}). Check server logs for details.",
        )

    checkout_url = resp.json()["data"]["attributes"]["url"]
    return CheckoutResponse(url=checkout_url)


@router.get("/subscription", response_model=SubscriptionStatusResponse)
def get_subscription_status(user: User = Depends(get_current_user)):
    return SubscriptionStatusResponse(
        is_pro=user.is_pro,
        subscription_status=user.subscription_status,
        subscription_ends_at=(
            user.subscription_ends_at.isoformat() if user.subscription_ends_at else None
        ),
    )


@router.post("/subscription/portal", response_model=PortalResponse)
@limiter.limit("10/minute")
def get_customer_portal(
    request: Request,
    user: User = Depends(get_current_user),
):
    if not user.lemon_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found",
        )

    if not settings.ls_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service is not configured",
        )

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                f"{LEMONSQUEEZY_API_BASE}/subscriptions/{user.lemon_subscription_id}",
                headers={
                    "Authorization": f"Bearer {settings.lemonsqueezy_api_key}",
                    "Accept": "application/vnd.api+json",
                },
            )
    except httpx.RequestError as e:
        logger.error("Lemon Squeezy portal request failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment service unavailable",
        )

    if resp.status_code != 200:
        logger.error("Failed to fetch subscription: %s %s", resp.status_code, resp.text[:500])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch subscription details",
        )

    portal_url = resp.json()["data"]["attributes"]["urls"]["customer_portal"]
    return PortalResponse(url=portal_url)


# --- Subscription webhook handlers ---


def _resolve_subscription_user(payload: dict, session: Session) -> User | None:
    """Resolve user from subscription webhook payload.

    Tries custom_data.user_id first (present on subscription_created),
    then falls back to lemon_subscription_id lookup.
    """
    # Try custom_data first (available on subscription_created)
    meta = payload.get("meta", {})
    custom_data = meta.get("custom_data", {})
    user_id_str = custom_data.get("user_id")
    if user_id_str:
        try:
            user = session.get(User, int(user_id_str))
            if user:
                return user
        except (ValueError, TypeError):
            pass

    # Fall back to subscription ID lookup
    subscription_id = str(payload.get("data", {}).get("id", ""))
    if subscription_id:
        user = session.exec(
            select(User).where(User.lemon_subscription_id == subscription_id)
        ).first()
        if user:
            return user

    return None


def _parse_subscription_ends_at(payload: dict) -> datetime | None:
    """Extract ends_at from subscription payload attributes."""
    ends_at_str = payload.get("data", {}).get("attributes", {}).get("ends_at")
    if not ends_at_str:
        return None
    try:
        return datetime.fromisoformat(ends_at_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _handle_subscription_event(event_name: str, payload: dict, session: Session) -> None:
    """Handle all subscription-related webhook events."""
    user = _resolve_subscription_user(payload, session)
    if not user:
        logger.warning("Subscription webhook: could not resolve user for event %s", event_name)
        return

    subscription_id = str(payload.get("data", {}).get("id", ""))
    attrs = payload.get("data", {}).get("attributes", {})
    ls_status = attrs.get("status", "")
    ends_at = _parse_subscription_ends_at(payload)
    now = datetime.now(timezone.utc)

    if event_name == "subscription_created":
        user.lemon_subscription_id = subscription_id
        user.subscription_status = ls_status or "active"
        user.subscription_ends_at = ends_at
        user.subscription_updated_at = now
        logger.info("Subscription created: user=%s sub=%s", user.id, subscription_id)

    elif event_name == "subscription_updated":
        user.subscription_status = ls_status
        user.subscription_ends_at = ends_at
        user.subscription_updated_at = now
        logger.info("Subscription updated: user=%s status=%s", user.id, ls_status)

    elif event_name == "subscription_cancelled":
        user.subscription_status = "cancelled"
        user.subscription_ends_at = ends_at
        user.subscription_updated_at = now
        logger.info("Subscription cancelled: user=%s ends_at=%s", user.id, ends_at)

    elif event_name == "subscription_resumed":
        user.subscription_status = ls_status or "active"
        user.subscription_ends_at = ends_at
        user.subscription_updated_at = now
        logger.info("Subscription resumed: user=%s", user.id)

    elif event_name == "subscription_expired":
        user.subscription_status = "expired"
        user.subscription_ends_at = ends_at
        user.subscription_updated_at = now
        logger.info("Subscription expired: user=%s", user.id)

    elif event_name == "subscription_payment_failed":
        user.subscription_status = "past_due"
        user.subscription_updated_at = now
        logger.warning("Subscription payment failed: user=%s", user.id)

    session.add(user)
    session.commit()
