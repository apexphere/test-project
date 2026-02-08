"""Public Auth Routes with Rate Limiting."""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.token import RefreshToken
from app.schemas import (
    UserCreate,
    UserResponse,
    TokenResponse,
    TokenRefreshRequest,
)
from app.core.security import hash_password, verify_password
from app.core.jwt import (
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
    decode_token,
)
from app.core.rate_limit import limiter, LOGIN_LIMIT, REGISTER_LIMIT, REFRESH_LIMIT
from app.config import get_settings

router = APIRouter()
settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db)
) -> User:
    """Dependency to get current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    
    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(REGISTER_LIMIT)
def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account.
    
    Rate limited to 3 requests per minute per IP to prevent abuse.
    """
    # Check if email already exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user


@router.post("/login", response_model=TokenResponse)
@limiter.limit(LOGIN_LIMIT)
def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    """Authenticate user and return access token.
    
    Rate limited to 5 requests per minute per IP to prevent brute-force attacks.
    """
    # Find user
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )
    
    # Create access token
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        is_admin=user.is_admin,
        full_name=user.full_name,
    )
    
    # Create and store refresh token
    refresh_token = create_refresh_token()
    refresh_token_db = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_token_db)
    db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(REFRESH_LIMIT)
def refresh_token(
    request: Request,
    token_request: TokenRefreshRequest,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token.
    
    Rate limited to 10 requests per minute per IP.
    """
    token_hash = hash_refresh_token(token_request.refresh_token)
    
    # Find valid refresh token
    refresh_token_db = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not refresh_token_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    
    user = refresh_token_db.user
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )
    
    # Create new access token
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        is_admin=user.is_admin,
        full_name=user.full_name,
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    """Get current authenticated user info."""
    return current_user
