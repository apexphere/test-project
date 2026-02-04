import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ProductsPage extends BasePage {
  readonly path = '/products';
  
  // Page elements
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly productsGrid: Locator;
  readonly productCards: Locator;
  readonly loadingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly noProductsMessage: Locator;
  readonly pagination: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;
  readonly pageInfo: Locator;

  constructor(page: Page) {
    super(page);
    
    this.heading = page.locator('.products-page h1');
    this.searchInput = page.locator('.search-bar input');
    this.productsGrid = page.locator('.products-grid');
    this.productCards = page.locator('.product-card');
    this.loadingIndicator = page.locator('.loading');
    this.errorMessage = page.locator('.error-message');
    this.noProductsMessage = page.locator('.no-products');
    this.pagination = page.locator('.pagination');
    this.prevButton = page.locator('.pagination button:first-child');
    this.nextButton = page.locator('.pagination button:last-child');
    this.pageInfo = page.locator('.pagination span');
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for debounce/API call
    await this.page.waitForLoadState('networkidle');
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForLoadState('networkidle');
  }

  async getProductCount(): Promise<number> {
    await this.waitForProductsLoaded();
    return this.productCards.count();
  }

  async getProductNames(): Promise<string[]> {
    await this.waitForProductsLoaded();
    const names: string[] = [];
    const cards = await this.productCards.all();
    for (const card of cards) {
      const name = await card.locator('.product-name, h3').textContent();
      if (name) names.push(name);
    }
    return names;
  }

  async addProductToCart(productName: string): Promise<void> {
    const card = this.productCards.filter({ hasText: productName });
    await card.locator('button').click();
  }

  async waitForProductsLoaded(): Promise<void> {
    await expect(this.loadingIndicator).not.toBeVisible({ timeout: 10000 });
  }

  async goToNextPage(): Promise<void> {
    await this.nextButton.click();
    await this.waitForProductsLoaded();
  }

  async goToPrevPage(): Promise<void> {
    await this.prevButton.click();
    await this.waitForProductsLoaded();
  }

  async expectPageVisible(): Promise<void> {
    await expect(this.heading).toHaveText('Products');
    await expect(this.searchInput).toBeVisible();
  }

  async expectProductsDisplayed(): Promise<void> {
    await this.waitForProductsLoaded();
    await expect(this.productsGrid).toBeVisible();
    expect(await this.getProductCount()).toBeGreaterThan(0);
  }

  async expectNoProducts(): Promise<void> {
    await this.waitForProductsLoaded();
    await expect(this.noProductsMessage).toBeVisible();
  }
}
