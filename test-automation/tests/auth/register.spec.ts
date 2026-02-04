import { test, expect } from '@playwright/test';
import { RegisterPage, LoginPage } from '../../pages';
import { TEST_USERS, generateUniqueUser } from '../../utils/test-data';

test.describe('Registration', () => {
  let registerPage: RegisterPage;

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    await registerPage.open();
  });

  test('should display registration page correctly', async () => {
    await registerPage.expectPageVisible();
  });

  test('should register new user successfully', async ({ page }) => {
    const newUser = generateUniqueUser();
    
    await registerPage.register(newUser);
    await registerPage.expectRegisterSuccess();
    
    // Verify we can login with the new account
    const loginPage = new LoginPage(page);
    await loginPage.login(newUser.email, newUser.password);
    await loginPage.expectLoginSuccess();
  });

  test('should show error for existing email', async () => {
    const existingUser = TEST_USERS.user;
    
    await registerPage.register({
      fullName: 'Another User',
      email: existingUser.email,
      password: 'SomePassword123',
    });
    
    await registerPage.expectRegisterError();
  });

  test('should show error for invalid email format', async () => {
    await registerPage.emailInput.fill('not-an-email');
    await registerPage.passwordInput.fill('ValidPass123');
    await registerPage.submitButton.click();
    
    // HTML5 validation should prevent submission
    const emailInput = registerPage.emailInput;
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    expect(validationMessage).toBeTruthy();
  });

  test('should show error for short password', async () => {
    await registerPage.emailInput.fill('test@example.com');
    await registerPage.passwordInput.fill('12345'); // Less than 6 chars
    await registerPage.submitButton.click();
    
    // HTML5 minLength validation should prevent submission
    const passwordInput = registerPage.passwordInput;
    const validationMessage = await passwordInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    expect(validationMessage).toBeTruthy();
  });

  test('should navigate to login page', async () => {
    await registerPage.loginLink.click();
    await expect(registerPage.page).toHaveURL('/login');
  });

  test('should allow registration without full name', async ({ page }) => {
    const timestamp = Date.now();
    const userWithoutName = {
      email: `noname.${timestamp}@example.com`,
      password: 'ValidPass123',
    };
    
    await registerPage.register(userWithoutName);
    await registerPage.expectRegisterSuccess();
  });
});
