# Mini E-commerce SUT

A controlled System Under Test (SUT) for the test automation platform.

## Architecture

```
┌─────────────┐
│   React UI  │  :5173
└──────┬──────┘
       │ REST
┌──────▼──────┐
│  FastAPI    │  :8000
│  Backend    │
└──────┬──────┘
       │
┌──────▼──────┐     ┌───────────┐
│ PostgreSQL  │     │   Redis   │
│    :5432    │     │   :6379   │
└─────────────┘     └───────────┘
```

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Python + FastAPI
- **Database:** PostgreSQL
- **Cache/Sessions:** Redis
- **Auth:** JWT tokens

## Quick Start

### With Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Local Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Optional: Configure environment
cp .env.example .env  # Edit as needed

uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install

# Optional: Configure API URL (defaults to localhost:8000)
cp .env.example .env  # Edit VITE_API_URL if backend is elsewhere

npm run dev
```

## Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./ecommerce.db` | Database connection string |
| `SECRET_KEY` | (random) | JWT signing key |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Token expiry time |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection (optional) |
| `DEBUG` | `true` | Enable debug mode |

### Frontend (`frontend/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL |

## Project Structure

```
sut/
├── backend/
│   ├── app/
│   │   ├── api/routes/     # API endpoints
│   │   ├── core/           # Security, config, deps
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── db/             # Database setup
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/       # API client
│   │   └── store/          # State management
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Features (MVP)

- [ ] User registration & login
- [ ] Product catalog with categories
- [ ] Shopping cart
- [ ] Order placement
- [ ] Order history

## Purpose

This SUT is designed to:
1. Provide a realistic e-commerce application for testing
2. Allow intentional bug injection for testing auto-heal capabilities
3. Demonstrate various failure modes (API, DB, auth, UI)
