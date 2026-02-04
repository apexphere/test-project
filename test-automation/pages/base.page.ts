import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Common navigation elements
  get homeLink(): Locator {
    return this.page.locator('a[href="/"]').first();
  }

  get productsLink(): Locator {
    return this.page.locator('a[href="/products"]');
  }

  get cartLink(): Locator {
    return this.page.locator('a[href="/view_cart"]');
  }

  get signupLoginLink(): Locator {
    return this.page.locator('a[href="/login"]');
  }

  get contactUsLink(): Locator {
    return this.page.locator('a[href="/contact_us"]');
  }

  get logoutLink(): Locator {
    return this.page.locator('a[href="/logout"]');
  }

  get deleteAccountLink(): Locator {
    return this.page.locator('a[href="/delete_account"]');
  }

  // Common actions
  async navigate(path: string = '/'): Promise<void> {
    await this.page.goto(path);
  }

  async getLoggedInUser(): Promise<string | null> {
    const loggedInAs = this.page.locator('a:has-text("Logged in as")');
    if (await loggedInAs.isVisible()) {
      const text = await loggedInAs.textContent();
      return text?.replace('Logged in as ', '') || null;
    }
    return null;
  }

  async isLoggedIn(): Promise<boolean> {
    return (await this.getLoggedInUser()) !== null;
  }
}
