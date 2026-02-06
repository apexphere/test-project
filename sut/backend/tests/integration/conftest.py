"""Integration test fixtures - real database and HTTP client."""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwt

# Add backend app to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.db.database import Base
from app.core.deps import get_db
from app.main import app
from app.models.user import User
from app.models.product import Product, Category
from app.models.order import CartItem, Order, OrderItem, OrderStatus


# In-memory SQLite for test isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_engine():
    """Create a fresh in-memory database engine per test."""
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """Create a database session for tests."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create a test client with database override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # Session cleanup handled by db_session fixture
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# RSA key pair for JWT signing (generated once per module for speed)
@pytest.fixture(scope="module")
def rsa_key_pair():
    """Generate RSA key pair for JWT testing."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    
    return {"private": private_pem, "public": public_pem}


@pytest.fixture
def mock_jwt_settings(rsa_key_pair, monkeypatch):
    """Configure app to use test RSA keys for JWT validation."""
    from app.core import security
    
    # Clear any cached key
    security.clear_public_key_cache()
    
    # Mock get_public_key to return our test key
    monkeypatch.setattr(security, "get_public_key", lambda force_refresh=False: rsa_key_pair["public"])
    
    yield rsa_key_pair


def create_test_token(
    rsa_key_pair: dict,
    user_id: int = 123,
    email: str = "test@example.com",
    name: str = "Test User",
    is_admin: bool = False,
    expired: bool = False,
) -> str:
    """Create a signed JWT token for testing."""
    now = datetime.now(timezone.utc)
    exp = now - timedelta(hours=1) if expired else now + timedelta(hours=1)
    
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": name,
        "admin": is_admin,
        "iss": "auth-service",
        "exp": int(exp.timestamp()),
        "iat": int(now.timestamp()),
    }
    
    return jwt.encode(payload, rsa_key_pair["private"], algorithm="RS256")


@pytest.fixture
def auth_headers(rsa_key_pair, mock_jwt_settings) -> dict:
    """Get authorization headers for a regular user."""
    token = create_test_token(rsa_key_pair)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(rsa_key_pair, mock_jwt_settings) -> dict:
    """Get authorization headers for an admin user."""
    token = create_test_token(rsa_key_pair, user_id=999, email="admin@example.com", name="Admin", is_admin=True)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def expired_auth_headers(rsa_key_pair, mock_jwt_settings) -> dict:
    """Get authorization headers with an expired token."""
    token = create_test_token(rsa_key_pair, expired=True)
    return {"Authorization": f"Bearer {token}"}


# Data fixtures
@pytest.fixture
def sample_category(db_session: Session) -> Category:
    """Create a sample category."""
    category = Category(name="Electronics", description="Electronic devices")
    db_session.add(category)
    db_session.commit()
    db_session.refresh(category)
    return category


@pytest.fixture
def sample_product(db_session: Session, sample_category: Category) -> Product:
    """Create a sample product."""
    product = Product(
        name="Test Widget",
        description="A test product",
        price=29.99,
        stock=100,
        is_active=True,
        category_id=sample_category.id,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


@pytest.fixture
def sample_products(db_session: Session, sample_category: Category) -> list[Product]:
    """Create multiple sample products."""
    products = [
        Product(name="Widget A", price=10.00, stock=50, is_active=True, category_id=sample_category.id),
        Product(name="Widget B", price=20.00, stock=30, is_active=True, category_id=sample_category.id),
        Product(name="Widget C", price=30.00, stock=0, is_active=True, category_id=sample_category.id),
        Product(name="Inactive Widget", price=40.00, stock=10, is_active=False, category_id=sample_category.id),
    ]
    for p in products:
        db_session.add(p)
    db_session.commit()
    for p in products:
        db_session.refresh(p)
    return products


@pytest.fixture
def sample_user(db_session: Session) -> User:
    """Create a sample user (matches auth_headers token)."""
    user = User(
        auth_service_id=123,
        email="test@example.com",
        full_name="Test User",
        is_active=True,
        is_admin=False,
        hashed_password="",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session: Session) -> User:
    """Create an admin user (matches admin_auth_headers token)."""
    user = User(
        auth_service_id=999,
        email="admin@example.com",
        full_name="Admin",
        is_active=True,
        is_admin=True,
        hashed_password="",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user
