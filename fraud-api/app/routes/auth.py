"""
Auth router — /api/v1/auth/register, /api/v1/auth/login, /api/v1/auth/me
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import require_auth
from app.models.user import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_user,
    get_user_by_email,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(body: RegisterRequest):
    """
    Create a new account and return a JWT access token so the user is
    signed in immediately after registration.
    """
    try:
        user_doc = await create_user(
            email=body.email,
            full_name=body.full_name,
            plain_password=body.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    token = create_access_token(user_doc["email"])
    logger.info("New user registered: %s", user_doc["email"])
    return TokenResponse(access_token=token, user=UserPublic(**user_doc))


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email + password",
)
async def login(body: LoginRequest):
    """Authenticate and return a JWT access token."""
    user_doc = await authenticate_user(body.email, body.password)
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    token = create_access_token(user_doc["email"])
    logger.info("User logged in: %s", user_doc["email"])
    return TokenResponse(access_token=token, user=UserPublic(**user_doc))


@router.get(
    "/me",
    response_model=UserPublic,
    summary="Get current authenticated user",
)
async def me(current_user_email: str = Depends(require_auth)):
    """Returns the profile of the currently authenticated user (requires Bearer token)."""
    user_doc = await get_user_by_email(current_user_email)
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return UserPublic(**user_doc)

