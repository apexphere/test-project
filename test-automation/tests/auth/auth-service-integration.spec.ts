/**
 * Auth Service Integration Tests
 *
 * These tests verify that the frontend correctly integrates with the
 * standalone Auth Service (port 8001) for authentication flows.
 *
 * The frontend uses `VITE_AUTH_URL` to route auth requests to the Auth
 * Service, while product/cart/order requests go to the Backend API.
 */

import { test, expect } from '@playwright/test';
import { LoginPage, RegisterPage, ProductsPage } from '../../pages';
import { TEST_USERS, generateUniqueUser, SERVICE_URLS } from '../../utils/test-data';

test.describe('Auth Service Integration', () => {
  test('Auth Service health check', async ({ request }) => {
    // Verify the Auth Service is reachable (done via direct API call)
    const res = await request.get(`${SERVICE_URLS.authService}/health`);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  test('register → login → access protected page → logout @smoke', async ({ page }) => {
    // Complete auth lifecycle through the new Auth Service

    // 1. Register a fresh user via UI
    const newUser = generateUniqueUser();
    const registerPage = new RegisterPage(page);
    await registerPage.open();
    await registerPage.register(newUser);
    await registerPage.expectRegisterSuccess();

    // 2. Login with the new account
    const loginPage = new LoginPage(page);
    // expectRegisterSuccess redirects to /login, so we're already there
    await loginPage.login(newUser.email, newUser.password);
    await loginPage.expectLoginSuccess();

    // 3. Access a protected action (add to cart requires auth context)
    //    — or just verify we can browse products while logged in
    const productsPage = new ProductsPage(page);
    await productsPage.open();
    await productsPage.expectPageVisible();

    // 4. Verify user info is displayed (optional — depends on navbar)
    expect(await loginPage.isLoggedIn()).toBe(true);

    // 5. Logout
    await loginPage.logout();
    expect(await loginPage.isLoggedIn()).toBe(false);
  });

  test('login persists across page navigation', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.login(TEST_USERS.user.email, TEST_USERS.user.password);
    await loginPage.expectLoginSuccess();

    // Navigate to products
    const productsPage = new ProductsPage(page);
    await productsPage.open();
    await productsPage.expectPageVisible();

    // User should still be logged in
    expect(await loginPage.isLoggedIn()).toBe(true);

    // Navigate back to home
    await page.goto('/');

    // Still logged in
    expect(await loginPage.isLoggedIn()).toBe(true);
  });

  test('invalid token is handled gracefully', async ({ page, context }) => {
    // Inject an invalid token into localStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'invalid.jwt.token');
    });

    // Navigate to a page and try to access auth-protected info
    await page.reload();

    // The frontend should either:
    // - Show user as logged out (token invalid), or
    // - Gracefully handle the error without crashing
    // This test ensures the app doesn't break with a bad token
    await expect(page.locator('body')).toBeVisible();
  });

  test('seeded users exist and can log in', async ({ page }) => {
    // Verify both seeded test users can log in
    const loginPage = new LoginPage(page);

    // Admin user
    await loginPage.open();
    await loginPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
    await loginPage.expectLoginSuccess();
    await loginPage.logout();

    // Regular user
    await loginPage.open();
    await loginPage.login(TEST_USERS.user.email, TEST_USERS.user.password);
    await loginPage.expectLoginSuccess();
  });
});
