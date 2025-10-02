import { expect, test } from '@playwright/test';

function randomEmail() {
  return `qa-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function testRouteHeaders() {
  const apiKey = process.env.PLAYWRIGHT_TEST_API_KEY;
  return apiKey ? { 'x-test-route-key': apiKey } : undefined;
}

test.describe('lead capture API', () => {
  test('returns 200 with valid payload', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    const email = randomEmail();
    const response = await request.post('/api/lead', {
      data: { email },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({});

    await request.delete('/api/test/leads', {
      data: { email },
      headers: testRouteHeaders(),
    });
  });

  test('rejects invalid email', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    const response = await request.post('/api/lead', {
      data: { email: 'invalid-email' },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
