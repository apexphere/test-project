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

### Local Development with k3d (recommended)

```bash
# One-command setup
./dev.sh up

# Or use the k8s script directly
./k8s/scripts/local-setup.sh
```

This will:
1. Create a k3d cluster (`sut-dev`) with nginx ingress
2. Build all Docker images
3. Import images into k3d
4. Deploy all services via Kustomize
5. Wait for pods to be ready
6. Seed the databases with test data

**Access the app:**
- Frontend: http://localhost:8080
- Backend API: http://localhost:8080/api
- Auth Service: http://localhost:8080/auth
- API Docs: http://localhost:8080/api/docs

**Test Credentials:**
- Admin: admin@example.com / admin123
- User: user@example.com / user123

### Cleanup

```bash
./dev.sh down

# Or manually
./k8s/scripts/local-cleanup.sh
```

### Manual Development (without k8s)

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

> **Note:** Manual development requires running PostgreSQL and Redis separately.

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
├── auth-service/           # Separate auth microservice
├── k8s/                    # Kubernetes manifests
│   ├── base/               # Shared manifests
│   ├── overlays/           # Environment-specific configs
│   └── scripts/            # Setup/cleanup scripts
└── README.md
```

## Kubernetes Details

See [k8s/README.md](k8s/README.md) for detailed Kubernetes setup, troubleshooting, and architecture diagrams.

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
