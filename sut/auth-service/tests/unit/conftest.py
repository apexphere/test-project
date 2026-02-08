# Unit tests - fixtures inherited from parent tests/conftest.py
from unittest.mock import MagicMock
import pytest
from starlette.requests import Request
from starlette.testclient import TestClient


@pytest.fixture
def mock_request():
    """Create a mock Starlette Request for rate-limited endpoints."""
    # Create a minimal ASGI scope for the request
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/test",
        "query_string": b"",
        "headers": [],
        "server": ("127.0.0.1", 8000),
        "client": ("127.0.0.1", 12345),
    }
    
    # Create a real Request object with mock app state
    request = Request(scope)
    
    # Mock the app state for the limiter
    request.scope["app"] = MagicMock()
    request.scope["app"].state.limiter = MagicMock()
    
    return request
