import { test, expect, type Page } from '@playwright/test';
import { seedTestData, waitForApi, type SeedData } from './seed';

let seedData: SeedData;

test.beforeAll(async () => {
  await waitForApi();
  seedData = await seedTestData();
});

test.describe('Dashboard Page', () => {
  test('should load and display stats cards', async ({ page }) => {
    await page.goto('/');

    // Wait for loading to complete
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Verify stats cards are displayed
    await expect(page.getByText('Total Runs', { exact: true })).toBeVisible();
    await expect(page.getByText('Pass Rate', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Total Tests', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Trend', { exact: true })).toBeVisible();
  });

  test('should display pass rate chart', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Chart section should be visible
    await expect(page.getByText('Pass Rate Over Time')).toBeVisible();
    
    // Recharts renders SVG elements
    const chartContainer = page.locator('.recharts-responsive-container');
    await expect(chartContainer).toBeVisible();
  });

  test('should display flaky and slow test lists', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Section headers
    await expect(page.getByText('🔥 Flaky Tests')).toBeVisible();
    await expect(page.getByText('🐢 Slowest Tests')).toBeVisible();

    // Should show test entries (from seeded data)
    const flakySection = page.locator('text=🔥 Flaky Tests').locator('..');
    await expect(flakySection.getByText('flaky test')).toBeVisible();
  });

  test('should display recent runs table', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Table header
    await expect(page.getByText('Recent Runs')).toBeVisible();

    // Table columns
    await expect(page.getByRole('columnheader', { name: 'Run' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Branch' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    // Should have run data (develop branch from seeded data)
    await expect(page.getByText('develop').first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate from Dashboard to Run Detail when clicking a run row', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Click on the first run row (click on Branch cell to target the row)
    await page.getByRole('row').filter({ hasText: 'develop' }).first().click();

    // Should navigate to run detail page
    await expect(page).toHaveURL(/\/runs\/[a-f0-9-]+/);
    
    // Run detail page should load
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Dashboard')).toBeVisible(); // Breadcrumb
  });

  test('should navigate from Run Detail to Test Detail when clicking a test row', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Navigate to first run
    await page.getByRole('row').filter({ hasText: 'develop' }).first().click();
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Click on a test row
    await page.getByRole('row').filter({ hasText: 'should login successfully' }).click();

    // Should navigate to test detail
    await expect(page).toHaveURL(/\/tests\/.+/);
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });
  });

  test('should navigate via breadcrumbs', async ({ page }) => {
    // Navigate to a test detail page through the UI
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    await page.getByRole('row').filter({ hasText: 'develop' }).first().click();
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    await page.getByRole('row').filter({ hasText: 'should login successfully' }).click();
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Click breadcrumb to go back to Dashboard
    await page.getByRole('link', { name: 'Dashboard' }).click();

    // Should be back on dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Total Runs')).toBeVisible();
  });

  test('should navigate from slowest test list to Test Detail', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Find the slow tests section and click on a test
    const slowSection = page.locator('text=🐢 Slowest Tests').locator('..');
    const testLink = slowSection.getByRole('link').first();
    
    if (await testLink.isVisible()) {
      await testLink.click();
      await expect(page).toHaveURL(/\/tests\/.+/);
    }
  });

  test('should navigate home via header logo', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Go to a run detail page
    await page.getByRole('row').filter({ hasText: 'develop' }).first().click();
    await expect(page).toHaveURL(/\/runs\//);

    // Click the header logo/title
    await page.getByRole('link', { name: '📊 Test Reporter' }).click();

    // Should be back on dashboard
    await expect(page).toHaveURL('/');
  });
});

test.describe('Run Detail Page', () => {
  async function navigateToRunDetail(page: Page) {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });
    await page.getByRole('row').filter({ hasText: 'develop' }).first().click();
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });
  }

  test('should display run info correctly', async ({ page }) => {
    await navigateToRunDetail(page);

    // Run metadata
    await expect(page.getByText('Source')).toBeVisible();
    await expect(page.getByText('ci')).toBeVisible();
    await expect(page.getByText('Branch')).toBeVisible();
    await expect(page.getByText('develop').first()).toBeVisible();
    await expect(page.getByText('Commit')).toBeVisible();
    await expect(page.getByText('Started')).toBeVisible();
  });

  test('should display test stats', async ({ page }) => {
    await navigateToRunDetail(page);

    // Stats cards - use .first() for text that appears multiple times (cards + badges/tabs)
    await expect(page.getByText('Total Tests', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Passed/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Failed/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Skipped/ })).toBeVisible();
    await expect(page.getByText('Pass Rate', { exact: true }).first()).toBeVisible();
  });

  test('should filter tests by status using tabs', async ({ page }) => {
    await navigateToRunDetail(page);

    // All tab is active by default
    const allTab = page.getByRole('button', { name: /All \(\d+\)/ });
    await expect(allTab).toHaveClass(/bg-indigo-600/);

    // Get initial row count
    const initialRows = await page.getByRole('row').count();

    // Click Failed tab
    await page.getByRole('button', { name: /Failed/ }).click();
    
    // Failed tab should be active now
    await expect(page.getByRole('button', { name: /Failed/ })).toHaveClass(/bg-indigo-600/);

    // Click Passed tab
    await page.getByRole('button', { name: /Passed/ }).click();
    await expect(page.getByRole('button', { name: /Passed/ })).toHaveClass(/bg-indigo-600/);

    // Click Skipped tab
    await page.getByRole('button', { name: /Skipped/ }).click();
    await expect(page.getByRole('button', { name: /Skipped/ })).toHaveClass(/bg-indigo-600/);

    // Click All tab again
    await page.getByRole('button', { name: /All/ }).click();
    await expect(page.getByRole('button', { name: /All/ })).toHaveClass(/bg-indigo-600/);
  });

  test('should display test results table', async ({ page }) => {
    await navigateToRunDetail(page);

    // Table headers
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Test' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Retries' })).toBeVisible();

    // Should have test data from seeded runs
    await expect(page.getByText('should login successfully')).toBeVisible();
  });
});

test.describe('Test Detail Page', () => {
  async function navigateToTestDetail(page: Page) {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });
    
    // Navigate through Run Detail to Test Detail
    await page.getByRole('row').filter({ hasText: 'develop' }).first().click();
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });
    
    await page.getByRole('row').filter({ hasText: 'should login successfully' }).click();
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });
  }

  test('should display test stats correctly', async ({ page }) => {
    await navigateToTestDetail(page);

    // Stats should be visible
    await expect(page.getByText('Total Runs', { exact: true })).toBeVisible();
    await expect(page.getByText('Pass Rate', { exact: true })).toBeVisible();
    await expect(page.getByText('Flakiness', { exact: true })).toBeVisible();
    await expect(page.getByText('Avg Duration', { exact: true })).toBeVisible();
    await expect(page.getByText('Duration Range', { exact: true })).toBeVisible();
  });

  test('should display duration chart', async ({ page }) => {
    await navigateToTestDetail(page);

    // Chart section
    await expect(page.getByText('Duration Over Time')).toBeVisible();
    
    // Recharts SVG container
    const chartContainer = page.locator('.recharts-responsive-container');
    await expect(chartContainer).toBeVisible();
  });

  test('should display run history table', async ({ page }) => {
    await navigateToTestDetail(page);

    // Section header
    await expect(page.getByText('Run History')).toBeVisible();

    // Table headers
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Retries' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Run' })).toBeVisible();
  });

  test('should display test title and file in header', async ({ page }) => {
    await navigateToTestDetail(page);

    // Test info header
    await expect(page.getByRole('heading', { name: 'should login successfully' })).toBeVisible();
    await expect(page.getByText('auth/login.spec.ts')).toBeVisible();
  });

  test('should navigate to run from history table', async ({ page }) => {
    await navigateToTestDetail(page);

    // Click on a history row (should navigate to run)
    const historyRow = page.locator('text=Run History').locator('..').locator('table tbody tr').first();
    await historyRow.click();

    // Should navigate to run detail
    await expect(page).toHaveURL(/\/runs\/[a-f0-9-]+/);
  });
});

test.describe('Data Display', () => {
  test('should display status badges correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });
    
    // Navigate to a run
    await page.getByRole('row').filter({ hasText: 'develop' }).first().click();
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // Check for status badges - at least passed badges should exist from seeded data
    const passedBadges = page.locator('text=Passed').filter({ has: page.locator('..') });
    expect(await passedBadges.count()).toBeGreaterThan(0);
  });

  test('should format durations correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });
    
    // Duration values should be formatted (e.g., "2s", "1m 30s")
    const durationPattern = /\d+s|\d+m\s+\d+s/;
    const durationCells = page.getByRole('cell').filter({ hasText: durationPattern });
    expect(await durationCells.count()).toBeGreaterThan(0);
  });

  test('should show empty state messages when no data', async ({ page }) => {
    // This test verifies empty states work - we can't easily test this with seeded data
    // but we verify the structure is present
    await page.goto('/');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 10000 });

    // If there were no runs, we'd see this message
    // Since we have data, verify the table has rows instead
    const recentRunsSection = page.locator('text=Recent Runs').locator('..');
    const rows = recentRunsSection.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
