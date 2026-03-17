"""
Auth service — password hashing, JWT creation/verification,
user CRUD against MongoDB `users` collection.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
import bcrypt

from app.core.config import get_settings
from app.services.database import get_db

# ── bcrypt context ─────────────────────────────────────────────────────────────
# bcrypt 4.x raises ValueError for passwords > 72 bytes even when we pre-slice.
# Disable that built-in guard; we handle truncation explicitly in _truncate().
_pwd_ctx = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    # Removed: bcrypt__handle_long_passwords="truncate" — not a valid passlib
    # CryptContext option; bcrypt 4.x rejects it and raises on long passwords.
)

def _truncate(plain: str) -> str:
    """
    Truncate to at most 72 bytes, never splitting a multi-byte UTF-8 character.
    Uses 'ignore' only as a fallback guard; the while-loop ensures correctness.
    """
    encoded = plain.encode("utf-8")
    if len(encoded) <= 72:
        return plain  # Fast path — no truncation needed at all

    # Walk back from byte 72 until we land on a clean character boundary.
    # UTF-8 continuation bytes are 0x80–0xBF (0b10xxxxxx).
    # We need to stop at a byte that is NOT a continuation byte.
    cut = 72
    while cut > 0 and (encoded[cut] & 0xC0) == 0x80:
        cut -= 1

    return encoded[:cut].decode("utf-8")  # No 'ignore' needed — boundary is clean



def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_truncate(plain).encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_truncate(plain).encode("utf-8"), hashed.encode("utf-8"))
# ── JWT helpers ────────────────────────────────────────────────────────────────

def create_access_token(email: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Optional[str]:
    """Return the email (subject) if the token is valid, else None."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except JWTError:
        return None


# ── MongoDB user CRUD ──────────────────────────────────────────────────────────

async def get_user_by_email(email: str) -> Optional[dict]:
    col = get_db()["users"]
    return await col.find_one({"email": email}, {"_id": 0})


async def create_user(email: str, full_name: str, plain_password: str) -> dict:
    """
    Insert a new user. Returns the stored user doc (without _id).
    Raises ValueError if the email is already taken.
    """
    col = get_db()["users"]

    if await col.find_one({"email": email}):
        raise ValueError("Email already registered.")

    doc = {
        "email": email,
        "full_name": full_name,
        "hashed_password": hash_password(plain_password),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await col.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def authenticate_user(email: str, plain_password: str) -> Optional[dict]:
    """
    Return user doc if credentials are valid, else None.
    """
    user = await get_user_by_email(email)
    if not user:
        return None
    if not verify_password(plain_password, user["hashed_password"]):
        return None
    return user


async def ensure_users_indexes() -> None:
    """Create a unique index on `email` for the users collection."""
    from pymongo import IndexModel, ASCENDING
    col = get_db()["users"]
    await col.create_indexes([
        IndexModel([("email", ASCENDING)], unique=True, name="idx_users_email"),
    ])
