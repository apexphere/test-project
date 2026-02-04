import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages';
import { TEST_USERS, INVALID_DATA } from '../../utils/test-data';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.open();
  });

  test('should display login page correctly', async () => {
    await loginPage.expectPageVisible();
  });

  test('should login successfully with valid credentials', async () => {
    const { email, password } = TEST_USERS.user;
    
    await loginPage.login(email, password);
    await loginPage.expectLoginSuccess();
    
    // Verify user is logged in via navbar
    expect(await loginPage.isLoggedIn()).toBe(true);
  });

  test('should show error for invalid credentials', async () => {
    const { email, password } = INVALID_DATA.nonExistentUser;
    
    await loginPage.login(email, password);
    await loginPage.expectLoginError();
  });

  test('should show error for empty email', async () => {
    await loginPage.passwordInput.fill('somepassword');
    await loginPage.submitButton.click();
    
    // HTML5 validation should prevent submission
    const emailInput = loginPage.emailInput;
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    expect(validationMessage).toBeTruthy();
  });

  test('should show error for empty password', async () => {
    await loginPage.emailInput.fill('test@example.com');
    await loginPage.submitButton.click();
    
    // HTML5 validation should prevent submission
    const passwordInput = loginPage.passwordInput;
    const validationMessage = await passwordInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    expect(validationMessage).toBeTruthy();
  });

  test('should navigate to register page', async () => {
    await loginPage.registerLink.click();
    await expect(loginPage.page).toHaveURL('/register');
  });

  test('should logout successfully after login', async ({ page }) => {
    const { email, password } = TEST_USERS.user;
    
    await loginPage.login(email, password);
    await loginPage.expectLoginSuccess();
    
    // Logout
    await loginPage.logout();
    
    // Verify logged out - login link should be visible again
    await expect(loginPage.navLogin).toBeVisible();
    expect(await loginPage.isLoggedIn()).toBe(false);
  });
});
