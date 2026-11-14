import { expect, test } from '@playwright/test';

// The tests decide the API outcome themselves, so they do not depend on what is running locally.

test('home shows the title and reports the API as reachable', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Abaqo' })).toBeVisible();
  await expect(page.getByText('API operativa')).toBeVisible();
});

test('home reports the API as unreachable when the request fails', async ({ page }) => {
  await page.route('**/api/health', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByText('API no disponible')).toBeVisible();
});
