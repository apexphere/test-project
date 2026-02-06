# Design Document: Test Data Manager Service

| Field | Value |
|-------|-------|
| **Author** | BA/Architect (AI) |
| **Created** | 2026-02-07 |
| **Status** | 📝 Draft |
| **Issue** | #33 |
| **Epic** | #13 |

---

## 1. Overview

### 1.1 Problem Statement

The current test automation suite manages test data in a fragmented way:

1. **Scattered data seeding**: User data is seeded via `global-setup.ts` (Auth Service API), while product/category data is seeded via `seed.py` (Backend CLI). These run at different times, through different mechanisms.

2. **Limited test scenarios**: Tests can only use pre-seeded static data (`TEST_USERS.admin`, `TEST_USERS.user`) or generate random data (`generateUniqueUser()`). There's no way to create complex, realistic test scenarios on-demand.

3. **No cleanup mechanism**: Tests that create data (e.g., registration tests creating new users, orders placed during tests) leave orphan data that accumulates over time. This can cause:
   - Test interference (one test's data affects another)
   - Database bloat in long-running environments
   - Flaky tests due to unexpected state

4. **Hard-coded data in tests**: Tests embed specific email addresses, product IDs, and other data, making them brittle and hard to maintain.

5. **CI complexity**: The CI pipeline must coordinate Docker commands to seed data, with fragile timing and error handling.

6. **No programmatic access**: There's no API for tests to create specific data scenarios at runtime (e.g., "create a user with 3 orders and an empty cart").

### 1.2 Goals

1. **Centralize** all test data management into a single service
2. **Provide a programmatic API** for creating test data on-demand
3. **Support complex scenarios** (user with orders, products with specific stock levels, etc.)
4. **Enable data cleanup** (per-test, per-suite, or scheduled)
5. **Integrate seamlessly** with Playwright tests via a client library
6. **Work in CI** with minimal configuration
7. **Support data isolation** between parallel test runs

### 1.3 Non-Goals

- Production data management (this is test-only)
- Database migrations (handled by each service)
- Performance testing data generation (out of scope for now)
- Cross-environment data sync (each environment is independent)
- Replacing existing seed scripts immediately (gradual migration)

---

## 2. Current State

### 2.1 Test Data Sources

| Data Type | Current Source | Created By | Cleanup |
|-----------|----------------|------------|---------|
| Test users (admin, user) | `global-setup.ts` | Playwright before all tests | Never |
| Dynamic users | `generateUniqueUser()` | Individual tests | Never |
| Products/Categories | `seed.py` | Docker exec in CI | Never |
| Orders | Not pre-seeded | Tests could create, but don't | Never |
| Cart items | Not pre-seeded | Tests could create, but don't | Never |

### 2.2 Data Flow Today

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CI Pipeline                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   1. Start containers                                               │
│      └─▶ docker compose up                                         │
│                                                                      │
│   2. Seed product data (backend)                                    │
│      └─▶ docker exec backend python -m app.db.seed                 │
│                                                                      │
│   3. Run Playwright tests                                           │
│      └─▶ npx playwright test                                       │
│          │                                                          │
│          ├─▶ global-setup.ts                                       │
│          │   └─▶ POST /auth/register (seed users via Auth API)    │
│          │                                                          │
│          └─▶ Test files                                            │
│              └─▶ generateUniqueUser() for each new user test       │
│                                                                      │
│   4. Stop containers (data lost)                                    │
│      └─▶ docker compose down -v                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Pain Points in Detail

**1. Test Interference**
```typescript
// Test A creates an order for user@example.com
// Test B expects user@example.com to have no orders
// If Test A runs first, Test B fails
```

**2. Flaky Data Dependencies**
```typescript
// Test expects product with ID 1 to exist
// But seed order or parallel runs can affect IDs
const product = await page.locator('[data-product-id="1"]');
```

**3. CI Fragility**
```yaml
# Must wait for backend, then exec into container
- name: Seed test data
  run: docker compose exec -T backend python -m app.db.seed
# If container isn't ready, this fails silently or hangs
```

---

## 3. Target Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                    test-data-manager service                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                         REST API                                 ││
│  │  POST /api/seed              - Seed baseline data               ││
│  │  POST /api/users             - Create user(s)                   ││
│  │  POST /api/products          - Create product(s)                ││
│  │  POST /api/orders            - Create order(s)                  ││
│  │  POST /api/scenarios/:name   - Create predefined scenario       ││
│  │  DELETE /api/cleanup         - Clean test data                  ││
│  │  GET /api/health             - Health check                     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Data Management Core                          ││
│  │  • Scenario definitions (YAML/JSON)                             ││
│  │  • Entity factories (User, Product, Order, etc.)                ││
│  │  • Relationship builder (user with orders, etc.)                ││
│  │  • Cleanup tracker (track created data for rollback)            ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              │                                       │
│            ┌─────────────────┼─────────────────┐                    │
│            ▼                 ▼                 ▼                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Auth Service │  │   Backend    │  │  Direct DB   │              │
│  │  Client      │  │   Client     │  │  (optional)  │              │
│  │  (HTTP)      │  │   (HTTP)     │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Auth Service │      │   Backend    │      │   Databases  │
│  :8001       │      │   :8000      │      │  (Postgres)  │
└──────────────┘      └──────────────┘      └──────────────┘
```

### 3.2 Integration with Playwright Tests

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Playwright Test Suite                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  import { TestDataManager } from '@test-automation/data-manager';   │
│                                                                      │
│  const tdm = new TestDataManager({ baseUrl: 'http://localhost:3001' });
│                                                                      │
│  test.beforeAll(async () => {                                       │
│    // Seed baseline data once                                       │
│    await tdm.seed();                                                │
│  });                                                                │
│                                                                      │
│  test.beforeEach(async () => {                                      │
│    // Start tracking data created in this test                     │
│    tdm.startTracking();                                            │
│  });                                                                │
│                                                                      │
│  test.afterEach(async () => {                                       │
│    // Clean up data created during this test                       │
│    await tdm.cleanup();                                            │
│  });                                                                │
│                                                                      │
│  test('user with orders scenario', async () => {                    │
│    const { user, orders } = await tdm.scenario('user-with-orders', {│
│      orderCount: 3,                                                 │
│    });                                                              │
│    // Test now has a user with 3 orders                            │
│  });                                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Model

### 4.1 Entities Managed

| Entity | Source System | Creation Method | Cleanup Method |
|--------|---------------|-----------------|----------------|
| **Users** | Auth Service | POST /auth/register | DELETE via Auth internal API or direct DB |
| **Products** | Backend | POST /api/products (admin) or direct DB | DELETE via API or direct DB |
| **Categories** | Backend | POST /api/categories (admin) or direct DB | DELETE via API or direct DB |
| **Orders** | Backend | POST /api/orders or direct DB | DELETE via direct DB |
| **Order Items** | Backend | Created with orders | Cascade delete with orders |
| **Cart Items** | Backend | POST /api/cart or direct DB | DELETE via API or direct DB |

### 4.2 Entity Factories

Each entity type has a factory that generates realistic data:

```typescript
// Example: User Factory
interface UserFactoryOptions {
  email?: string;        // Override email
  password?: string;     // Override password
  fullName?: string;     // Override name
  isAdmin?: boolean;     // Create admin user
}

function createUser(options?: UserFactoryOptions): UserData {
  const id = nanoid(8);
  return {
    email: options?.email ?? `test-user-${id}@example.com`,
    password: options?.password ?? `TestPass${id}!`,
    fullName: options?.fullName ?? `Test User ${id}`,
    isAdmin: options?.isAdmin ?? false,
  };
}
```

```typescript
// Example: Order Factory
interface OrderFactoryOptions {
  userId: number;
  itemCount?: number;     // Number of line items (default: 1-3)
  status?: OrderStatus;   // Order status (default: random)
}

function createOrder(options: OrderFactoryOptions): OrderData {
  return {
    userId: options.userId,
    items: generateOrderItems(options.itemCount ?? randomInt(1, 3)),
    status: options.status ?? randomOrderStatus(),
    shippingAddress: generateAddress(),
  };
}
```

### 4.3 Predefined Scenarios

Scenarios are reusable, named data configurations:

```yaml
# scenarios/user-with-orders.yaml
name: user-with-orders
description: A user with purchase history
parameters:
  orderCount:
    type: integer
    default: 2
    min: 1
    max: 10

steps:
  - entity: user
    as: user
    
  - entity: order
    count: "{{ parameters.orderCount }}"
    with:
      userId: "{{ user.id }}"
      status: delivered

returns:
  user: "{{ user }}"
  orders: "{{ orders }}"
```

```yaml
# scenarios/empty-cart.yaml
name: empty-cart
description: A logged-in user with an empty cart

steps:
  - entity: user
    as: user
    
  # Explicitly no cart items

returns:
  user: "{{ user }}"
```

```yaml
# scenarios/cart-with-products.yaml
name: cart-with-products
description: A user with items in their cart
parameters:
  itemCount:
    type: integer
    default: 2

steps:
  - entity: user
    as: user
    
  - entity: cartItem
    count: "{{ parameters.itemCount }}"
    with:
      userId: "{{ user.id }}"
      # Products selected randomly from available products

returns:
  user: "{{ user }}"
  cartItems: "{{ cartItems }}"
```

---

## 5. API Design

### 5.1 Endpoints

#### Seed Baseline Data

```yaml
POST /api/seed:
  description: Seed baseline data (idempotent)
  request:
    force: boolean (optional, default: false)  # Re-seed even if already seeded
  response:
    200:
      seeded: boolean
      users: int
      products: int
      categories: int
    
# Creates:
# - 2 default users (admin, user)
# - 4 categories
# - 14 products
```

#### Create User

```yaml
POST /api/users:
  description: Create one or more users
  request:
    count: int (optional, default: 1)
    email: string (optional)
    password: string (optional)
    fullName: string (optional)
    isAdmin: boolean (optional)
  response:
    201:
      users: User[]
      trackingIds: string[]  # For cleanup
```

#### Create Product

```yaml
POST /api/products:
  description: Create one or more products
  request:
    count: int (optional, default: 1)
    name: string (optional)
    price: float (optional)
    stock: int (optional)
    categoryId: int (optional)
  response:
    201:
      products: Product[]
      trackingIds: string[]
```

#### Create Order

```yaml
POST /api/orders:
  description: Create an order for a user
  request:
    userId: int (required)
    items: OrderItemInput[] (optional, auto-generated if omitted)
    status: string (optional)
  response:
    201:
      order: Order
      trackingId: string
```

#### Execute Scenario

```yaml
POST /api/scenarios/:name:
  description: Execute a predefined scenario
  params:
    name: string (scenario name)
  request:
    parameters: object (scenario-specific params)
  response:
    201:
      data: object (scenario-defined return data)
      trackingIds: string[]
  errors:
    404: Scenario not found
    400: Invalid parameters
```

#### Cleanup

```yaml
DELETE /api/cleanup:
  description: Clean up test data
  request:
    trackingIds: string[] (optional, clean specific items)
    all: boolean (optional, clean all test data)
    olderThan: string (optional, clean data older than duration, e.g., "1h")
  response:
    200:
      deleted:
        users: int
        products: int
        orders: int
        cartItems: int
```

#### Health Check

```yaml
GET /api/health:
  description: Service health and dependency status
  response:
    200:
      status: "healthy" | "degraded" | "unhealthy"
      dependencies:
        authService: "up" | "down"
        backend: "up" | "down"
        database: "up" | "down" (if direct DB access)
```

### 5.2 Client Library

TypeScript client for Playwright tests:

```typescript
// test-data-manager/client/src/index.ts

export class TestDataManager {
  private baseUrl: string;
  private trackingIds: string[] = [];

  constructor(options: { baseUrl: string }) {
    this.baseUrl = options.baseUrl;
  }

  /** Seed baseline data (call once in globalSetup) */
  async seed(): Promise<SeedResult> {
    const res = await fetch(`${this.baseUrl}/api/seed`, { method: 'POST' });
    return res.json();
  }

  /** Create user(s) */
  async createUser(options?: CreateUserOptions): Promise<CreateUserResult> {
    const res = await fetch(`${this.baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options ?? {}),
    });
    const result = await res.json();
    this.trackingIds.push(...result.trackingIds);
    return result;
  }

  /** Create product(s) */
  async createProduct(options?: CreateProductOptions): Promise<CreateProductResult> {
    const res = await fetch(`${this.baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options ?? {}),
    });
    const result = await res.json();
    this.trackingIds.push(...result.trackingIds);
    return result;
  }

  /** Create order */
  async createOrder(options: CreateOrderOptions): Promise<CreateOrderResult> {
    const res = await fetch(`${this.baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    const result = await res.json();
    this.trackingIds.push(result.trackingId);
    return result;
  }

  /** Execute a predefined scenario */
  async scenario<T = unknown>(
    name: string,
    parameters?: Record<string, unknown>
  ): Promise<ScenarioResult<T>> {
    const res = await fetch(`${this.baseUrl}/api/scenarios/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameters }),
    });
    const result = await res.json();
    this.trackingIds.push(...result.trackingIds);
    return result;
  }

  /** Start tracking for cleanup (call in beforeEach) */
  startTracking(): void {
    this.trackingIds = [];
  }

  /** Cleanup tracked data (call in afterEach) */
  async cleanup(): Promise<CleanupResult> {
    if (this.trackingIds.length === 0) {
      return { deleted: { users: 0, products: 0, orders: 0, cartItems: 0 } };
    }
    
    const res = await fetch(`${this.baseUrl}/api/cleanup`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingIds: this.trackingIds }),
    });
    const result = await res.json();
    this.trackingIds = [];
    return result;
  }

  /** Cleanup all test data (call in globalTeardown) */
  async cleanupAll(): Promise<CleanupResult> {
    const res = await fetch(`${this.baseUrl}/api/cleanup`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    return res.json();
  }
}
```

---

## 6. Data Lifecycle

### 6.1 Lifecycle Stages

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Test Data Lifecycle                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. SEED (Global Setup - once per test run)                   │  │
│  │    • Create baseline data (default users, products)          │  │
│  │    • Idempotent - safe to call multiple times                │  │
│  │    • Takes ~2-3 seconds                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 2. CREATE (Per-test setup - beforeEach or during test)       │  │
│  │    • Create scenario-specific data                           │  │
│  │    • Track all created entities for cleanup                  │  │
│  │    • Fast - typically <500ms per scenario                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 3. TEST (Test execution)                                     │  │
│  │    • Tests use created data                                  │  │
│  │    • Tests may create additional data (also tracked)         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 4. CLEANUP (Per-test teardown - afterEach)                   │  │
│  │    • Delete all tracked entities from this test              │  │
│  │    • Restore database to post-seed state                     │  │
│  │    • Fast - typically <200ms                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 5. TEARDOWN (Global Teardown - optional)                     │  │
│  │    • Clean all test data (optional, for CI)                  │  │
│  │    • Runs after all tests complete                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Tracking Mechanism

Each created entity is assigned a tracking ID:

```typescript
interface TrackedEntity {
  trackingId: string;      // UUID
  entityType: 'user' | 'product' | 'order' | 'cartItem';
  entityId: number | string;
  service: 'auth' | 'backend';
  createdAt: Date;
  createdBy: string;       // Test run ID or session ID
}
```

The service maintains an in-memory map (or Redis for distributed) of tracked entities:

```typescript
// In-memory tracking (single instance)
const trackedEntities = new Map<string, TrackedEntity>();

// On create
function trackEntity(entity: TrackedEntity): string {
  const trackingId = nanoid();
  trackedEntities.set(trackingId, { ...entity, trackingId });
  return trackingId;
}

// On cleanup
async function cleanupEntities(trackingIds: string[]): Promise<void> {
  for (const id of trackingIds) {
    const entity = trackedEntities.get(id);
    if (entity) {
      await deleteEntity(entity);
      trackedEntities.delete(id);
    }
  }
}
```

### 6.3 Cleanup Strategies

| Strategy | When | Use Case |
|----------|------|----------|
| **Per-test cleanup** | afterEach | Isolate tests, prevent interference |
| **Suite cleanup** | afterAll | Clean up after a test file |
| **Global cleanup** | globalTeardown | Clean everything after test run |
| **Scheduled cleanup** | Cron job | Clean orphaned data in shared environments |
| **Age-based cleanup** | On-demand | Clean data older than X hours |

---

## 7. Integration Points

### 7.1 Playwright Tests (test-automation)

**Updated global-setup.ts:**

```typescript
import { TestDataManager } from '@test-automation/data-manager';

const tdm = new TestDataManager({
  baseUrl: process.env.TEST_DATA_MANAGER_URL || 'http://localhost:3001',
});

async function globalSetup(): Promise<void> {
  console.log('\n🔧 Global Setup — Test Data Manager\n');
  
  // Wait for test-data-manager to be healthy
  await tdm.waitForHealthy(30_000);
  
  // Seed baseline data
  const result = await tdm.seed();
  console.log(`Seeded: ${result.users} users, ${result.products} products`);
  
  console.log('\n✅ Global setup complete\n');
}

export default globalSetup;
```

**Updated playwright.config.ts:**

```typescript
export default defineConfig({
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  // ...
});
```

**Example test with data manager:**

```typescript
import { test } from '@playwright/test';
import { TestDataManager } from '@test-automation/data-manager';

const tdm = new TestDataManager({
  baseUrl: process.env.TEST_DATA_MANAGER_URL || 'http://localhost:3001',
});

test.beforeEach(async () => {
  tdm.startTracking();
});

test.afterEach(async () => {
  await tdm.cleanup();
});

test('user can view their order history', async ({ page }) => {
  // Create a user with orders using a scenario
  const { user, orders } = await tdm.scenario('user-with-orders', {
    orderCount: 3,
  });
  
  // Login as the created user
  await page.goto('/login');
  await page.fill('[name="email"]', user.email);
  await page.fill('[name="password"]', user.password);
  await page.click('button[type="submit"]');
  
  // Navigate to order history
  await page.goto('/orders');
  
  // Verify orders are displayed
  await expect(page.locator('.order-card')).toHaveCount(3);
});
```

### 7.2 CI Pipeline (GitHub Actions)

**Updated ci.yml:**

```yaml
jobs:
  e2e-tests:
    steps:
      # ... checkout, setup ...
      
      - name: Start SUT and test-data-manager
        run: |
          cd sut
          docker compose -f docker-compose.ci.yml up -d --build
          
          cd ../test-data-manager
          docker compose up -d --build
      
      - name: Wait for services
        run: |
          # Wait for test-data-manager
          timeout 60 bash -c 'until curl -s http://localhost:3001/api/health | grep -q healthy; do sleep 2; done'
          echo "test-data-manager ready!"
      
      - name: Run E2E tests
        run: |
          cd test-automation
          npx playwright test
        env:
          TEST_DATA_MANAGER_URL: http://localhost:3001
      
      - name: Cleanup test data
        if: always()
        run: |
          curl -X DELETE http://localhost:3001/api/cleanup \
            -H "Content-Type: application/json" \
            -d '{"all": true}'
```

### 7.3 test-reporter Integration

The test-data-manager can provide context to test-reporter:

```typescript
// When a test fails, include data context in the report
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === 'failed') {
    // Attach created data info to test report
    const dataContext = tdm.getCreatedEntities();
    await testInfo.attach('test-data', {
      body: JSON.stringify(dataContext, null, 2),
      contentType: 'application/json',
    });
  }
  
  await tdm.cleanup();
});
```

### 7.4 Local Development

Developers can use the data manager locally:

```bash
# Start test-data-manager
cd test-data-manager
docker compose up -d

# Seed data for manual testing
curl -X POST http://localhost:3001/api/seed

# Create a specific scenario
curl -X POST http://localhost:3001/api/scenarios/user-with-orders \
  -H "Content-Type: application/json" \
  -d '{"parameters": {"orderCount": 5}}'

# Cleanup when done
curl -X DELETE http://localhost:3001/api/cleanup -d '{"all": true}'
```

---

## 8. Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | TypeScript | Consistent with test-automation, type safety |
| Runtime | Node.js 20 | LTS, matches project standard |
| Framework | Express.js | Simple, well-known, matches test-reporter |
| HTTP Client | node-fetch / axios | For calling Auth Service and Backend APIs |
| Database | None initially | Uses APIs only; optional direct DB for cleanup |
| Validation | Zod | Type-safe schema validation |
| ID Generation | nanoid | Short, URL-safe unique IDs |
| Containerization | Docker | Consistent deployment, matches other services |

### 8.1 Direct Database Access (Optional)

For efficient cleanup, the service can optionally connect directly to databases:

| Database | Connection | Purpose |
|----------|------------|---------|
| Auth DB (Postgres) | Direct | Delete test users efficiently |
| Backend DB (Postgres) | Direct | Delete orders, cart items, test products |

This is optional because:
- API-only mode is simpler and less coupled
- Direct DB is faster for bulk cleanup
- Can be enabled per-environment

---

## 9. Implementation Plan

### Phase 1: Core Service + Seed API (Est: 4-5 hours)

**Deliverables:**
- `test-data-manager/` directory structure
- Express.js server with health endpoint
- `POST /api/seed` - seed baseline data via Auth/Backend APIs
- Docker + docker-compose for local dev
- Basic tests

**Acceptance Criteria:**
- Service starts and responds to health checks
- Seed endpoint creates default users and products
- Can replace current global-setup.ts seeding

### Phase 2: Entity Creation APIs (Est: 4-5 hours)

**Deliverables:**
- `POST /api/users` - create users with tracking
- `POST /api/products` - create products with tracking
- `POST /api/orders` - create orders with tracking
- Tracking mechanism for cleanup

**Acceptance Criteria:**
- Can create individual entities via API
- All created entities are tracked
- Entities have auto-generated realistic data

### Phase 3: Cleanup API (Est: 3-4 hours)

**Deliverables:**
- `DELETE /api/cleanup` - cleanup by tracking IDs
- Cleanup all test data option
- Age-based cleanup option

**Acceptance Criteria:**
- Cleanup by tracking ID works
- Cleanup all test data works
- No orphaned data after cleanup

### Phase 4: Scenarios (Est: 4-5 hours)

**Deliverables:**
- Scenario definition format (YAML)
- `POST /api/scenarios/:name` - execute scenarios
- 3-5 predefined scenarios:
  - `baseline` - default seed data
  - `user-with-orders` - user with purchase history
  - `cart-with-products` - user with cart items
  - `empty-user` - fresh user with no data
  - `admin-user` - admin user for admin tests

**Acceptance Criteria:**
- Scenarios execute correctly
- Parameters are validated
- Complex data relationships work

### Phase 5: Client Library (Est: 3-4 hours)

**Deliverables:**
- `@test-automation/data-manager` npm package
- TypeScript types for all APIs
- Helper methods for common operations
- Integration with Playwright lifecycle

**Acceptance Criteria:**
- Can install and use in test-automation
- Works with beforeEach/afterEach
- Proper TypeScript types

### Phase 6: CI Integration (Est: 2-3 hours)

**Deliverables:**
- Update CI workflow to include test-data-manager
- Update test-automation to use client library
- Documentation

**Acceptance Criteria:**
- CI runs with test-data-manager
- All existing tests still pass
- New tests can use data manager

**Total Estimate: 20-26 hours**

---

## 10. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API dependency failures | High | Medium | Health checks, retries, graceful degradation |
| Cleanup misses data | Medium | Medium | Track all creates, periodic full cleanup |
| Performance overhead | Low | Low | Keep operations fast, parallel where possible |
| Breaking existing tests | High | Low | Incremental migration, both old and new work |
| Distributed tracking complexity | Medium | Low | Start with in-memory, add Redis if needed |
| Auth token management | Medium | Medium | Use admin token, refresh on expiry |

---

## 11. Decisions Requiring Approval

### 11.1 API-Only vs Direct Database Access

**Question:** Should test-data-manager use only service APIs, or also have direct database access?

**Option A: API-Only (Recommended)**
- ✅ Simpler architecture, fewer connection strings
- ✅ Tests the actual API surface
- ✅ No schema coupling
- ❌ Slower for bulk cleanup
- ❌ Some cleanup operations may not have API support

**Option B: API + Direct Database**
- ✅ Fast bulk cleanup
- ✅ Can clean data without API support
- ❌ More complex configuration
- ❌ Schema coupling

**Recommendation:** Start with **Option A (API-Only)**, add direct database access in a later phase if cleanup performance becomes an issue.

**Status:** 🔵 Pending Approval

### 11.2 Scenario Definition Format

**Question:** How should scenarios be defined?

**Option A: YAML Files (Recommended)**
- ✅ Human-readable
- ✅ Easy to version control
- ✅ Non-developers can understand
- ❌ Need YAML parser
- ❌ Limited expressiveness

**Option B: TypeScript Functions**
- ✅ Full programming power
- ✅ Type safety
- ❌ Requires TypeScript knowledge
- ❌ Less accessible

**Option C: JSON Files**
- ✅ Native to JavaScript
- ✅ Easy to parse
- ❌ Verbose, no comments

**Recommendation:** **Option A (YAML Files)** for readability, with TypeScript for complex scenarios that need logic.

**Status:** 🔵 Pending Approval

### 11.3 Package Distribution

**Question:** How should the client library be distributed?

**Option A: Local Package (Recommended for now)**
- ✅ No npm publishing needed
- ✅ Monorepo style
- ❌ Harder to use outside this project

**Option B: Published npm Package**
- ✅ Standard npm workflow
- ❌ Publishing overhead
- ❌ Versioning complexity

**Recommendation:** **Option A (Local Package)** for now. The client lives in `test-data-manager/client/` and is referenced via workspace or relative path.

**Status:** 🔵 Pending Approval

### 11.4 Test Data Isolation Strategy

**Question:** How do we prevent test interference when running tests in parallel?

**Option A: Tracking IDs (Recommended)**
- ✅ Simple, works with existing parallel model
- ✅ Each test cleans up its own data
- ❌ Requires careful tracking
- ❌ Race conditions possible

**Option B: Database Per Test Worker**
- ✅ Complete isolation
- ❌ Complex setup
- ❌ Resource intensive

**Option C: Namespace/Prefix All Test Data**
- ✅ Easy to identify test data
- ✅ Bulk cleanup by prefix
- ❌ Requires changes to data model

**Recommendation:** **Option A (Tracking IDs)** for simplicity. Consider Option C (namespacing) as an enhancement.

**Status:** 🔵 Pending Approval

---

## 12. Success Criteria

- [ ] test-data-manager service runs and is healthy
- [ ] Seed endpoint creates baseline data
- [ ] Entity creation endpoints work (users, products, orders)
- [ ] Cleanup endpoint deletes tracked data
- [ ] At least 3 scenarios are defined and working
- [ ] Client library works with Playwright tests
- [ ] CI pipeline integrates test-data-manager
- [ ] All existing E2E tests still pass
- [ ] Documentation is complete
- [ ] At least one test uses the new data manager

---

## 13. Appendix

### A. Directory Structure

```
test-data-manager/
├── server/                     # Backend API
│   ├── src/
│   │   ├── index.ts            # App entry point
│   │   ├── config.ts           # Environment config
│   │   ├── routes/
│   │   │   ├── index.ts        # Route aggregator
│   │   │   ├── seed.ts         # POST /api/seed
│   │   │   ├── users.ts        # POST /api/users
│   │   │   ├── products.ts     # POST /api/products
│   │   │   ├── orders.ts       # POST /api/orders
│   │   │   ├── scenarios.ts    # POST /api/scenarios/:name
│   │   │   └── cleanup.ts      # DELETE /api/cleanup
│   │   ├── services/
│   │   │   ├── auth-client.ts  # Auth Service API client
│   │   │   ├── backend-client.ts # Backend API client
│   │   │   ├── tracker.ts      # Entity tracking
│   │   │   └── scenarios.ts    # Scenario executor
│   │   ├── factories/
│   │   │   ├── user.ts         # User data factory
│   │   │   ├── product.ts      # Product data factory
│   │   │   └── order.ts        # Order data factory
│   │   └── scenarios/          # Scenario definitions
│   │       ├── baseline.yaml
│   │       ├── user-with-orders.yaml
│   │       └── cart-with-products.yaml
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── client/                     # TypeScript client library
│   ├── src/
│   │   ├── index.ts            # Main export
│   │   └── types.ts            # Type definitions
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml          # Local dev
├── Dockerfile                  # Production image
└── README.md
```

### B. Example Scenario: user-with-orders

```yaml
# server/src/scenarios/user-with-orders.yaml
name: user-with-orders
description: |
  Creates a user with completed orders.
  Useful for testing order history, reorder flows, etc.

parameters:
  orderCount:
    type: integer
    default: 2
    min: 1
    max: 10
    description: Number of orders to create
    
  orderStatus:
    type: string
    default: delivered
    enum: [pending, confirmed, shipped, delivered]
    description: Status for all orders

steps:
  # Step 1: Create the user
  - action: createUser
    as: user
    
  # Step 2: Create orders for the user
  - action: createOrder
    count: "{{ parameters.orderCount }}"
    as: orders
    with:
      userId: "{{ user.id }}"
      status: "{{ parameters.orderStatus }}"

returns:
  user:
    id: "{{ user.id }}"
    email: "{{ user.email }}"
    password: "{{ user.password }}"
  orders: "{{ orders }}"
```

### C. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | 3001 |
| `AUTH_SERVICE_URL` | Auth Service base URL | http://localhost:8001 |
| `BACKEND_URL` | Backend API base URL | http://localhost:8000 |
| `AUTH_DB_URL` | Auth database URL (optional) | - |
| `BACKEND_DB_URL` | Backend database URL (optional) | - |
| `LOG_LEVEL` | Logging level | info |

### D. Client Library Usage Examples

```typescript
// Basic usage
import { TestDataManager } from '@test-automation/data-manager';

const tdm = new TestDataManager({
  baseUrl: 'http://localhost:3001',
});

// Create a user
const { users } = await tdm.createUser({ email: 'specific@example.com' });
const user = users[0];

// Create multiple users
const { users: manyUsers } = await tdm.createUser({ count: 5 });

// Create a product with specific attributes
const { products } = await tdm.createProduct({
  name: 'Test Product',
  price: 99.99,
  stock: 10,
});

// Create an order for a user
const { order } = await tdm.createOrder({
  userId: user.id,
  status: 'delivered',
});

// Use a scenario
const scenario = await tdm.scenario('user-with-orders', {
  orderCount: 3,
  orderStatus: 'shipped',
});
console.log(scenario.data.user);    // { id, email, password }
console.log(scenario.data.orders);  // [{ id, status, ... }, ...]

// Cleanup everything created
await tdm.cleanup();
```

---

*End of Design Document*
