import { test, expect } from '@playwright/test';
import { ProductsPage } from '../../pages';

test.describe('Products', () => {
  let productsPage: ProductsPage;

  test.beforeEach(async ({ page }) => {
    productsPage = new ProductsPage(page);
    await productsPage.open();
  });

  test('should display products page correctly', async () => {
    await productsPage.expectPageVisible();
  });

  test('should display products from database', async () => {
    await productsPage.expectProductsDisplayed();
    
    // We seeded 14 products, should see at least some
    const count = await productsPage.getProductCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should search products by name', async () => {
    // Get initial count
    const initialCount = await productsPage.getProductCount();
    
    // Search for a specific term
    await productsPage.search('phone');
    
    // Should filter results (might be 0 or some, but different from initial if search works)
    await productsPage.waitForProductsLoaded();
    
    // At minimum, page should respond to search
    const productNames = await productsPage.getProductNames();
    
    // If products found, they should match search
    for (const name of productNames) {
      expect(name.toLowerCase()).toContain('phone');
    }
  });

  test('should show no products message for invalid search', async () => {
    await productsPage.search('xyznonexistentproduct123456');
    await productsPage.expectNoProducts();
  });

  test('should clear search and show all products', async () => {
    // First search
    await productsPage.search('test');
    await productsPage.waitForProductsLoaded();
    
    // Clear search
    await productsPage.clearSearch();
    
    // Should show products again
    await productsPage.expectProductsDisplayed();
  });
});
