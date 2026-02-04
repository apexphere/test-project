import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export interface RegisterData {
  fullName?: string;
  email: string;
  password: string;
}

export class RegisterPage extends BasePage {
  readonly path = '/register';
  
  // Form elements
  readonly heading: Locator;
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    super(page);
    
    this.heading = page.locator('.auth-form h2');
    this.fullNameInput = page.locator('#fullName');
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.error-message');
    this.loginLink = page.locator('.auth-link a[href="/login"]');
  }

  async register(data: RegisterData): Promise<void> {
    if (data.fullName) {
      await this.fullNameInput.fill(data.fullName);
    }
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    await this.submitButton.click();
  }

  async expectRegisterSuccess(): Promise<void> {
    // After successful registration, user is redirected to login
    await expect(this.page).toHaveURL('/login');
  }

  async expectRegisterError(message?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async expectPageVisible(): Promise<void> {
    await expect(this.heading).toHaveText('Register');
    await expect(this.fullNameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
