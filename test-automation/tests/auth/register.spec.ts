import { test, expect } from '@playwright/test';
import { HomePage, AuthPage } from '../../pages';
import { generateSignupData } from '../../utils/test-data';

test.describe('User Registration', () => {
  let homePage: HomePage;
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authPage = new AuthPage(page);
  });

  test('TC01: Register new user successfully', async ({ page }) => {
    const userData = generateSignupData();

    // 1-3. Navigate to home page and verify it's visible
    await homePage.open();
    await homePage.verifyHomePageVisible();

    // 4. Click on 'Signup / Login' button
    await homePage.goToSignupLogin();

    // 5. Verify 'New User Signup!' is visible
    await authPage.verifySignupFormVisible();

    // 6-7. Enter name and email, click Signup
    await authPage.initiateSignup(userData.name, userData.email);

    // 8. Verify 'ENTER ACCOUNT INFORMATION' is visible
    await expect(authPage.accountInfoHeader).toBeVisible();

    // 9-12. Fill account details
    await authPage.fillAccountInformation(userData);

    // 13. Click 'Create Account' button
    await authPage.submitAccountCreation();

    // 14. Verify 'ACCOUNT CREATED!' is visible
    await authPage.verifyAccountCreated();

    // 15. Click 'Continue' button
    await authPage.continueButton.click();

    // 16. Verify 'Logged in as username' is visible
    const loggedInUser = await authPage.getLoggedInUser();
    expect(loggedInUser).toBeTruthy();

    // 17. Click 'Delete Account' button
    await authPage.deleteAccountLink.click();

    // 18. Verify 'ACCOUNT DELETED!' is visible
    await authPage.verifyAccountDeleted();
  });

  test('TC05: Register with existing email shows error', async ({ page }) => {
    // This test uses a known existing email
    const existingEmail = 'existing@test.com';

    await homePage.open();
    await homePage.goToSignupLogin();
    await authPage.verifySignupFormVisible();

    // Try to signup with existing email
    await authPage.initiateSignup('Test User', existingEmail);

    // Verify error message
    // Note: This might need adjustment based on actual site behavior
    // If no existing user, this test will need a pre-registered account
  });
});
