# Auth Service

Standalone authentication microservice for the Mini E-commerce platform.

## Status

🚧 **Scaffolded** - Awaiting design approval before implementation.

## Overview

This service handles all authentication concerns:
- User registration and management
- JWT token issuance (RS256)
- Token validation
- Password hashing (bcrypt)

## API Endpoints

### Public (Frontend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create new user |
| POST | `/auth/login` | Get access token |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user |

### Internal (Service-to-Service)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/internal/validate` | Validate JWT token |
| GET | `/internal/users/{id}` | Get user by ID |

## Tech Stack

- **Language:** Python 3.11
- **Framework:** FastAPI
- **Database:** PostgreSQL
- **Auth:** JWT (RS256)
- **Password:** bcrypt

## Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run locally
uvicorn app.main:app --port 8001 --reload

# Run tests
pytest
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | Required |
| `PRIVATE_KEY` | JWT signing key | Required |
| `PUBLIC_KEY` | JWT verification key | Required |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token TTL | 60 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh TTL | 7 |

## Design Document

See: [`docs/design/001-auth-service-extraction.md`](../../docs/design/001-auth-service-extraction.md)
