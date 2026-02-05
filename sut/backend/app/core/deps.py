"""FastAPI dependencies — auth, database, etc."""
from typing import Generator, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.core.security import decode_token
from app.models.user import User

# Token URL now points at the auth service, but OAuth2PasswordBearer only
# needs this for the OpenAPI docs — the actual login happens on auth-service.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class UserContext(BaseModel):
    """Lightweight user context extracted from JWT claims.

    Use this when you only need identity info and don't need
    the full ORM model (e.g., no DB relationships).
    """
    id: int
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
        id=int(user_id),
        email=email,
        full_name=payload.get("name"),
        is_admin=payload.get("admin", False),
    )


async def get_current_user(
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> User:
    """Get (or create) the User ORM object from JWT claims.

    Cart and Orders routes need the ORM model for foreign-key
    relationships. We find-or-create so that a user registered
    via the auth service automatically gets a local record.
    """
    user = db.query(User).filter(User.id == ctx.id).first()

    if user is None:
        # First time this user touches the backend — create a
        # lightweight local record from the JWT claims.
        user = User(
            id=ctx.id,
            email=ctx.email,
            full_name=ctx.full_name,
            is_active=True,
            is_admin=ctx.is_admin,
            hashed_password="",  # No local password — auth is external
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Keep local record in sync with auth service claims
        changed = False
        if user.email != ctx.email:
            user.email = ctx.email
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

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure user is active."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
