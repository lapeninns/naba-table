import { test, expect } from '@playwright/test';

test('GET /api/health responds', async ({ request, baseURL }) => {
  expect(baseURL).toBeTruthy();
  const res = await request.get(`${baseURL}/api/health`);
  expect(res.ok()).toBeTruthy();
});
