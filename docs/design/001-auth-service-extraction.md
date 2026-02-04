# Design Document: Auth Service Extraction

| Field | Value |
|-------|-------|
| **Author** | Megan (AI) |
| **Created** | 2026-02-04 |
| **Status** | ✅ Approved |
| **Approved By** | Master |
| **Approved Date** | 2026-02-04 |

---

## 1. Overview

### 1.1 Problem Statement

The current SUT has authentication tightly coupled with the backend monolith. This doesn't reflect real-world architectures where authentication is often:
- A separate service (Auth0, Okta, Keycloak, Ping)
- Shared across multiple applications
- Independently scalable and maintainable

### 1.2 Goals

1. Extract authentication into a standalone microservice
2. Deploy on Kubernetes for realistic infrastructure testing
3. Enable future integration patterns (3rd party auth, payment services)
4. Provide a realistic test surface for:
   - Service-to-service communication failures
   - Auth service unavailability scenarios
   - Token validation edge cases

### 1.3 Non-Goals

- Full OAuth2/OIDC implementation (keep it simple)
- Multi-tenancy support
- Social login providers (Google, GitHub, etc.)
- Full microservices decomposition (only auth for now)

---

## 2. Current Architecture

```
┌──────────────┐     HTTP      ┌─────────────────────────────┐
│              │──────────────▶│         Backend             │
│   Frontend   │               │  ┌───────────────────────┐  │
│   (React)    │◀──────────────│  │ Auth (coupled)        │  │
│              │     JSON      │  │ • /api/auth/login     │  │
└──────────────┘               │  │ • /api/auth/register  │  │
                               │  │ • /api/auth/me        │  │
                               │  ├───────────────────────┤  │
                               │  │ Products              │  │
                               │  │ Cart                  │  │
                               │  │ Orders                │  │
                               │  └───────────────────────┘  │
                               └──────────────┬──────────────┘
                                              │
                               ┌──────────────▼──────────────┐
                               │    PostgreSQL / SQLite      │
                               │    (all tables together)    │
                               └─────────────────────────────┘
```

### Current Auth Flow

1. User submits credentials to `/api/auth/login`
2. Backend validates against `users` table
3. Backend issues JWT with user ID
4. Frontend stores JWT in localStorage
5. Subsequent requests include `Authorization: Bearer <token>`
6. Backend validates JWT signature and extracts user ID

---

## 3. Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Kubernetes Cluster                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                    ┌────────────────────────┐ │
│  │   Frontend   │───────────────────▶│   Backend (Monolith)   │ │
│  │   Service    │                    │   • Products API       │ │
│  │   (React)    │                    │   • Cart API           │ │
│  │              │        ┌──────────▶│   • Orders API         │ │
│  └──────────────┘        │           └───────────┬────────────┘ │
│         │                │                       │              │
│         │ Login/         │ Validate              │              │
│         │ Register       │ Token                 │              │
│         ▼                │                       │              │
│  ┌──────────────┐        │                       │              │
│  │ Auth Service │────────┘                       │              │
│  │              │                                │              │
│  │ • /login     │                                │              │
│  │ • /register  │                                │              │
│  │ • /validate  │                                │              │
│  │ • /users     │                                │              │
│  └──────┬───────┘                                │              │
│         │                                        │              │
│         ▼                                        ▼              │
│  ┌──────────────┐                    ┌────────────────────────┐ │
│  │   Auth DB    │                    │       Main DB          │ │
│  │  (users,     │                    │   (products, orders,   │ │
│  │   tokens)    │                    │    cart_items)         │ │
│  └──────────────┘                    └────────────────────────┘ │
│                                                                  │
│  ┌──────────────┐                                               │
│  │    Redis     │  (shared: sessions, cache)                    │
│  └──────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Target Auth Flow

1. **Login/Register**: Frontend → Auth Service directly
2. **Token Issuance**: Auth Service issues JWT (signed with private key)
3. **API Requests**: Frontend → Backend with JWT
4. **Token Validation**: Backend validates JWT signature (public key)
5. **User Info** (if needed): Backend → Auth Service `/users/{id}`

---

## 4. Auth Service Design

### 4.1 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | Python 3.11 | Consistency with backend |
| Framework | FastAPI | Same as backend, async support |
| Database | PostgreSQL | Production-ready, same as backend |
| Token | JWT (RS256) | Asymmetric keys for secure validation |
| Password | bcrypt | Industry standard |
| Container | Docker | Kubernetes deployment |

### 4.2 API Specification

#### Public Endpoints (exposed to Frontend)

```yaml
POST /auth/register:
  request:
    email: string (required)
    password: string (required, min 6 chars)
    full_name: string (optional)
  response:
    id: int
    email: string
    full_name: string
    created_at: datetime
  errors:
    400: Invalid input
    409: Email already exists

POST /auth/login:
  request:
    email: string
    password: string
  response:
    access_token: string (JWT)
    token_type: "bearer"
    expires_in: int (seconds)
  errors:
    401: Invalid credentials

POST /auth/refresh:
  headers:
    Authorization: Bearer <token>
  response:
    access_token: string (new JWT)
    token_type: "bearer"
    expires_in: int

GET /auth/me:
  headers:
    Authorization: Bearer <token>
  response:
    id: int
    email: string
    full_name: string
    is_admin: bool
```

#### Internal Endpoints (service-to-service)

```yaml
POST /internal/validate:
  request:
    token: string
  response:
    valid: bool
    user_id: int (if valid)
    claims: object (if valid)
  note: For backends that can't validate JWT locally

GET /internal/users/{user_id}:
  response:
    id: int
    email: string
    full_name: string
    is_admin: bool
  note: For backend to fetch user details
```

### 4.3 Data Model

```sql
-- Auth Service Database

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

### 4.4 JWT Structure

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "123",           // user_id
    "email": "user@example.com",
    "name": "Test User",
    "admin": false,
    "iat": 1706000000,      // issued at
    "exp": 1706003600,      // expires (1 hour)
    "iss": "auth-service"   // issuer
  }
}
```

### 4.5 Security Considerations

| Concern | Mitigation |
|---------|------------|
| Password storage | bcrypt with cost factor 12 |
| JWT signing | RS256 (asymmetric) - private key in Auth Service only |
| Token validation | Public key distributed to Backend |
| Token expiry | Access: 1 hour, Refresh: 7 days |
| Brute force | Rate limiting (future) |
| CORS | Configured per environment |

---

## 5. Backend Integration

### 5.1 Changes Required

1. **Remove auth routes** from backend (`/api/auth/*`)
2. **Remove User model** from backend (lives in Auth Service)
3. **Add JWT validation middleware** using Auth Service's public key
4. **Add Auth Service client** for user info lookups
5. **Update dependencies** (cart, orders reference user_id only)

### 5.2 Token Validation Options

**Option A: Local Validation (Recommended)**
- Backend has Auth Service's public key
- Validates JWT signature locally
- No network call needed
- Fast, resilient to Auth Service downtime

**Option B: Remote Validation**
- Backend calls Auth Service `/internal/validate`
- More coupling, slower
- Only use if complex validation needed

### 5.3 User Context

```python
# Backend middleware pseudocode

async def get_current_user(token: str) -> UserContext:
    # 1. Validate JWT signature (local, using public key)
    payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    
    # 2. Return minimal user context from token
    return UserContext(
        id=payload["sub"],
        email=payload["email"],
        is_admin=payload.get("admin", False)
    )
    
    # 3. (Optional) Fetch full user from Auth Service if needed
    # user = await auth_client.get_user(payload["sub"])
```

---

## 6. Kubernetes Design

### 6.1 Services

| Service | Replicas | Resources | Exposed |
|---------|----------|-----------|---------|
| frontend | 2 | 128Mi / 0.1 CPU | Yes (Ingress) |
| backend | 2 | 256Mi / 0.2 CPU | Yes (Ingress) |
| auth-service | 2 | 256Mi / 0.2 CPU | Yes (Ingress) |
| postgres-main | 1 | 512Mi / 0.5 CPU | No (ClusterIP) |
| postgres-auth | 1 | 256Mi / 0.2 CPU | No (ClusterIP) |
| redis | 1 | 128Mi / 0.1 CPU | No (ClusterIP) |

### 6.2 Kubernetes Resources

```
k8s/
├── base/
│   ├── namespace.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── backend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── auth-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── postgres-main/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── postgres-auth/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── redis/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ingress.yaml
├── overlays/
│   ├── local/           # k3d development
│   │   └── kustomization.yaml
│   └── ci/              # kind CI testing
│       └── kustomization.yaml
└── kustomization.yaml
```

### 6.3 Network Topology

```
                         ┌─────────────────┐
            Internet ───▶│     Ingress     │
                         └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ frontend │ │ backend  │ │  auth    │
              │ :80      │ │ :8000    │ │  :8001   │
              └──────────┘ └────┬─────┘ └────┬─────┘
                                │            │
                     ┌──────────┴───┐   ┌────┴─────┐
                     ▼              ▼   ▼          ▼
              ┌──────────┐   ┌──────────┐   ┌──────────┐
              │ postgres │   │  redis   │   │ postgres │
              │  (main)  │   │          │   │  (auth)  │
              │  :5432   │   │  :6379   │   │  :5432   │
              └──────────┘   └──────────┘   └──────────┘
```

### 6.4 Ingress Routes

| Path | Service | Port |
|------|---------|------|
| `/` | frontend | 80 |
| `/api/*` | backend | 8000 |
| `/auth/*` | auth-service | 8001 |

---

## 7. Migration Plan

### Phase 1: Auth Service Creation (Est: 2-3 hours)

1. Create `sut/auth-service/` directory structure
2. Implement FastAPI auth service
3. Generate RSA key pair for JWT signing
4. Write Dockerfile
5. Add unit tests
6. Test standalone with docker-compose

### Phase 2: Kubernetes Setup (Est: 2-3 hours)

1. Create k8s manifest structure
2. Write deployments for all services
3. Configure secrets (DB passwords, JWT keys)
4. Set up Ingress
5. Test with k3d locally

### Phase 3: Backend Integration (Est: 2-3 hours)

1. Remove auth code from backend
2. Add JWT validation middleware
3. Add Auth Service client
4. Update tests
5. Test full flow locally

### Phase 4: CI/CD Update (Est: 1-2 hours)

1. Update GitHub Actions to use kind
2. Deploy to k8s in CI
3. Run Playwright tests against k8s deployment
4. Verify all tests pass

### Phase 5: Documentation & Cleanup (Est: 1 hour)

1. Update README
2. Add architecture diagrams
3. Document local development setup
4. Clean up old docker-compose files

---

## 8. Testing Strategy

### 8.1 Unit Tests (Auth Service)

- Password hashing/verification
- JWT generation/validation
- User CRUD operations
- Input validation

### 8.2 Integration Tests

- Auth Service ↔ Auth DB
- Backend ↔ Auth Service
- Full auth flow (register → login → access protected route)

### 8.3 E2E Tests (Playwright)

- Existing tests should still pass
- Add tests for:
  - Auth service unavailability (graceful degradation)
  - Token expiry handling
  - Invalid token handling

### 8.4 Chaos Testing (Future)

- Kill Auth Service pod → verify backend handles gracefully
- Network partition → verify timeout handling
- Database unavailability → verify error responses

---

## 9. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Increased complexity | Medium | High | Keep auth service simple, good docs |
| Network latency | Low | Medium | Local JWT validation, no remote calls |
| Key management | High | Low | Store in k8s secrets, rotate plan |
| Auth service downtime | High | Low | Backend caches public key, graceful degradation |
| Migration breaks tests | Medium | Medium | Incremental migration, run tests at each step |

---

## 10. Decisions (Approved)

1. **Single or separate databases?**
   - ✅ **Decision: Separate** (auth has its own DB)
   - Simpler to manage, cleaner boundaries
   
2. **JWT signing algorithm?**
   - ✅ **Decision: RS256** (asymmetric)
   - Private key in Auth Service only
   - Public key distributed to Backend

3. **Token validation approach?**
   - ✅ **Decision: Local validation**
   - Backend has public key, no network call needed
   - Fast, resilient to Auth Service downtime

4. **How to handle user deletion?**
   - Soft delete in Auth Service
   - Backend keeps user_id references (orders history)

5. **Admin management?**
   - Keep in Auth Service
   - Backend checks `is_admin` claim in JWT

6. **Rate limiting?**
   - Phase 2: Add to Auth Service
   - Use Redis for distributed rate limiting

---

## 11. Success Criteria

- [ ] Auth Service deployed and accessible
- [ ] Backend validates JWT without calling Auth Service
- [ ] All 19 existing E2E tests pass
- [ ] New auth-specific tests pass
- [ ] Local k3d cluster works
- [ ] CI deploys to kind and tests pass
- [ ] Documentation complete

---

## 12. Appendix

### A. Directory Structure After Migration

```
test-project/
├── sut/
│   ├── auth-service/           # NEW
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── api/
│   │   │   │   └── routes/
│   │   │   ├── core/
│   │   │   │   ├── security.py
│   │   │   │   └── jwt.py
│   │   │   ├── models/
│   │   │   └── schemas/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── backend/                 # MODIFIED
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── api/routes/      # Remove auth.py
│   │   │   ├── core/
│   │   │   │   └── jwt.py       # NEW: JWT validation
│   │   │   └── clients/
│   │   │       └── auth.py      # NEW: Auth service client
│   │   └── ...
│   ├── frontend/                # MODIFIED (minor)
│   │   └── src/services/api.ts  # Update auth endpoints
│   ├── k8s/                     # NEW
│   │   ├── base/
│   │   └── overlays/
│   └── docker-compose.yml       # UPDATED
├── test-automation/
└── docs/
    └── design/
        └── 001-auth-service-extraction.md
```

### B. JWT Key Generation

```bash
# Generate RSA key pair
openssl genrsa -out auth-private.pem 2048
openssl rsa -in auth-private.pem -pubout -out auth-public.pem

# Private key → Auth Service (secret)
# Public key → Backend (configmap)
```

### C. Local Development Commands

```bash
# Start k3d cluster
k3d cluster create sut-dev --port 8080:80@loadbalancer

# Deploy
kubectl apply -k k8s/overlays/local

# Check status
kubectl get pods -n sut

# View logs
kubectl logs -n sut -l app=auth-service

# Port forward for debugging
kubectl port-forward -n sut svc/auth-service 8001:8001

# Delete cluster
k3d cluster delete sut-dev
```

---

*End of Design Document*
