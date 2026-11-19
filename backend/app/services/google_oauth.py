"""Verify Google ID tokens for 'Sign in with Google'.

The frontend uses Google Identity Services, which hands the browser a signed ID
token (a JWT). We verify it server-side — signature against Google's public keys,
audience == our client ID, issuer, and expiry — before trusting any claim.
"""

import logging

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

# Reused across requests; fetches and caches Google's signing certs internally.
_request = google_requests.Request()


def verify_google_token(credential: str) -> dict:
    """Validate a Google ID token and return its claims.

    Raises ValueError if the token is missing, malformed, not meant for us,
    expired, from the wrong issuer, or tied to an unverified email.
    """
    if not settings.google_client_id:
        raise ValueError("Google sign-in is not configured")

    # Verifies signature, audience (== our client id) and expiry; raises ValueError otherwise.
    claims = id_token.verify_oauth2_token(credential, _request, settings.google_client_id)

    if claims.get("iss") not in _ALLOWED_ISSUERS:
        raise ValueError("Unexpected token issuer")
    if not claims.get("sub"):
        raise ValueError("Token has no subject")
    if not claims.get("email"):
        raise ValueError("Token has no email")
    if not claims.get("email_verified"):
        raise ValueError("Google email is not verified")
    return claims
