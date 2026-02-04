import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Page-specific elements
  get slider(): Locator {
    return this.page.locator('#slider');
  }

  get featuredItems(): Locator {
    return this.page.locator('.features_items');
  }

  get subscriptionSection(): Locator {
    return this.page.locator('#footer');
  }

  get subscriptionEmailInput(): Locator {
    return this.page.locator('#susbscribe_email');
  }

  get subscriptionButton(): Locator {
    return this.page.locator('#subscribe');
  }

  // Actions
  async open(): Promise<void> {
    await this.navigate('/');
  }

  async verifyHomePageVisible(): Promise<void> {
    await expect(this.slider).toBeVisible();
    await expect(this.featuredItems).toBeVisible();
  }

  async subscribeWithEmail(email: string): Promise<void> {
    await this.subscriptionEmailInput.scrollIntoViewIfNeeded();
    await this.subscriptionEmailInput.fill(email);
    await this.subscriptionButton.click();
  }

  async goToSignupLogin(): Promise<void> {
    await this.signupLoginLink.click();
  }

  async goToProducts(): Promise<void> {
    await this.productsLink.click();
  }

  async goToCart(): Promise<void> {
    await this.cartLink.click();
  }
}
