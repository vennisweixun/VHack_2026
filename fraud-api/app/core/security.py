"""
FastAPI dependency — extracts and validates the Bearer JWT from every
protected request, returning the caller's email address.

Usage:
    from app.core.security import require_auth

    @router.get("/protected")
    async def protected_route(current_user_email: str = Depends(require_auth)):
        ...
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services.auth_service import decode_access_token

_bearer = HTTPBearer(auto_error=True)


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """Return the authenticated user's email, or raise HTTP 401."""
    email = decode_access_token(credentials.credentials)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return email
