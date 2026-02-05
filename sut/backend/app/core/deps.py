"""FastAPI dependencies — auth, database, etc."""
import logging
from typing import Generator, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.database import SessionLocal
from app.core.security import decode_token
from app.models.user import User

logger = logging.getLogger(__name__)

# Token URL now points at the auth service, but OAuth2PasswordBearer only
# needs this for the OpenAPI docs — the actual login happens on auth-service.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class UserContext(BaseModel):
    """Lightweight user context extracted from JWT claims.

    Use this when you only need identity info and don't need
    the full ORM model (e.g., no DB relationships).
    """
    auth_service_id: int  # ID from the auth service
    email: str
    full_name: Optional[str] = None
    is_admin: bool = False


def get_db() -> Generator:
    """Database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_user_context(
    token: str = Depends(oauth2_scheme),
) -> UserContext:
    """Extract user context from JWT token (no DB call)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    email = payload.get("email")
    if user_id is None or email is None:
        raise credentials_exception

    return UserContext(
        auth_service_id=int(user_id),
        email=email,
        full_name=payload.get("name"),
        is_admin=payload.get("admin", False),
    )


def _find_or_create_user(db: Session, ctx: UserContext) -> User:
    """Find or create user with race condition handling.
    
    Uses email as the unique identifier (not the auth service ID) to avoid
    ID collision between auth service and backend auto-increment sequences.
    
    Handles race conditions where two requests try to create the same user
    simultaneously by catching IntegrityError and retrying the fetch.
    """
    # Try to find existing user by email
    user = db.query(User).filter(User.email == ctx.email).first()
    
    if user is not None:
        return user
    
    # User doesn't exist — create a new local record
    user = User(
        # Let backend auto-assign ID (don't use auth service ID)
        email=ctx.email,
        auth_service_id=ctx.auth_service_id,
        full_name=ctx.full_name,
        is_active=True,
        is_admin=ctx.is_admin,
        hashed_password="",  # No local password — auth is external
    )
    
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("Created local user record for %s (auth_service_id=%d)", 
                    ctx.email, ctx.auth_service_id)
        return user
    except IntegrityError:
        # Race condition: another request created this user first
        db.rollback()
        logger.debug("Race condition on user create for %s, fetching existing", ctx.email)
        user = db.query(User).filter(User.email == ctx.email).first()
        if user is None:
            # This shouldn't happen, but handle it gracefully
            logger.error("User not found after IntegrityError for %s", ctx.email)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user record"
            )
        return user


def _sync_user_claims(db: Session, user: User, ctx: UserContext) -> None:
    """Sync user record with JWT claims if they differ.
    
    Only performs DB write if claims have actually changed.
    """
    changed = False
    
    # Update auth_service_id if not set (migration path for existing users)
    if user.auth_service_id != ctx.auth_service_id:
        user.auth_service_id = ctx.auth_service_id
        changed = True
    
    if user.full_name != ctx.full_name:
        user.full_name = ctx.full_name
        changed = True
    
    if user.is_admin != ctx.is_admin:
        user.is_admin = ctx.is_admin
        changed = True
    
    if changed:
        db.commit()
        db.refresh(user)
        logger.debug("Synced claims for user %s", ctx.email)


async def get_current_user(
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> User:
    """Get (or create) the User ORM object from JWT claims.

    Cart and Orders routes need the ORM model for foreign-key
    relationships. We find-or-create so that a user registered
    via the auth service automatically gets a local record.
    
    Uses email as the primary lookup key (not auth service ID) to avoid
    ID collision issues between services.
    """
    user = _find_or_create_user(db, ctx)
    _sync_user_claims(db, user, ctx)
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure user is active."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
