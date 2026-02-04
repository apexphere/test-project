"""Internal Service-to-Service Routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.schemas import UserResponse, TokenValidateRequest, TokenValidateResponse
from app.core.jwt import validate_token, get_public_key

router = APIRouter()


@router.post("/validate", response_model=TokenValidateResponse)
def validate_jwt(request: TokenValidateRequest):
    """Validate a JWT token and return claims.
    
    This endpoint is for services that cannot validate tokens locally.
    Prefer local validation using the public key when possible.
    """
    valid, claims, error = validate_token(request.token)
    
    if not valid:
        return TokenValidateResponse(
            valid=False,
            error=error,
        )
    
    return TokenValidateResponse(
        valid=True,
        user_id=int(claims.get("sub")),
        email=claims.get("email"),
        is_admin=claims.get("admin", False),
    )


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    """Get user details by ID.
    
    For internal service-to-service communication.
    Should be protected by network policies in production.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.get("/public-key")
def get_jwt_public_key():
    """Get the public key for JWT validation.
    
    Other services can use this to validate tokens locally
    without calling the auth service for each request.
    """
    return {
        "public_key": get_public_key(),
        "algorithm": "RS256",
    }
