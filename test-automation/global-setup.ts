/**
 * Global setup for Playwright tests.
 *
 * Seeds test users via the Auth Service API so that login/register tests
 * have the data they need regardless of how the services were started.
 *
 * The Auth Service may already seed users on first boot (via its own seed
 * script), but this setup is idempotent — it gracefully handles "email
 * already registered" (HTTP 409) responses.
 */

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || 'http://localhost:8001';

interface SeedUser {
  email: string;
  password: string;
  full_name: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'admin@example.com',
    password: 'admin123',
    full_name: 'Admin User',
  },
  {
    email: 'user@example.com',
    password: 'user1234',
    full_name: 'Test User',
  },
];

async function waitForService(
  url: string,
  timeoutMs = 30_000,
): Promise<void> {
  const start = Date.now();
  const healthUrl = `${url}/health`;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        console.log(`✓ Auth Service is healthy (${healthUrl})`);
        return;
      }
    } catch {
      // service not up yet — retry
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }

  throw new Error(
    `Auth Service did not become healthy within ${timeoutMs}ms (${healthUrl})`,
  );
}

async function seedUser(user: SeedUser): Promise<void> {
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });

  if (res.ok) {
    console.log(`  ✓ Created user: ${user.email}`);
  } else if (res.status === 409) {
    console.log(`  – User already exists: ${user.email}`);
  } else {
    const body = await res.text();
    throw new Error(
      `Failed to seed user ${user.email}: ${res.status} ${body}`,
    );
  }
}

async function globalSetup(): Promise<void> {
  console.log('\n🔧 Global Setup — Auth Service test data\n');
  console.log(`Auth Service URL: ${AUTH_SERVICE_URL}\n`);

  // 1. Wait for the Auth Service to be ready
  await waitForService(AUTH_SERVICE_URL);

  // 2. Seed test users
  console.log('Seeding test users …');
  for (const user of SEED_USERS) {
    await seedUser(user);
  }

  console.log('\n✅ Global setup complete\n');
}

export default globalSetup;
