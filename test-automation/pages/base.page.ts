import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;
  
  // Common navbar elements
  readonly navBrand: Locator;
  readonly navProducts: Locator;
  readonly navCart: Locator;
  readonly navOrders: Locator;
  readonly navLogin: Locator;
  readonly navRegister: Locator;
  readonly navLogout: Locator;
  readonly userName: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Navbar locators
    this.navBrand = page.locator('.navbar-brand a');
    this.navProducts = page.locator('.navbar-links a[href="/products"]');
    this.navCart = page.locator('.navbar-links a[href="/cart"]');
    this.navOrders = page.locator('.navbar-links a[href="/orders"]');
    this.navLogin = page.locator('.navbar-links a[href="/login"]');
    this.navRegister = page.locator('.navbar-links a[href="/register"]');
    this.navLogout = page.locator('.btn-logout');
    this.userName = page.locator('.user-name');
  }

  abstract readonly path: string;

  async open(): Promise<void> {
    await this.page.goto(this.path);
  }

  async goToProducts(): Promise<void> {
    await this.navProducts.click();
  }

  async goToCart(): Promise<void> {
    await this.navCart.click();
  }

  async goToLogin(): Promise<void> {
    await this.navLogin.click();
  }

  async goToRegister(): Promise<void> {
    await this.navRegister.click();
  }

  async logout(): Promise<void> {
    await this.navLogout.click();
  }

  async isLoggedIn(): Promise<boolean> {
    return this.navLogout.isVisible();
  }

  async getLoggedInUserName(): Promise<string | null> {
    if (await this.isLoggedIn()) {
      const text = await this.userName.textContent();
      return text?.replace('Hi, ', '') || null;
    }
    return null;
  }
}
