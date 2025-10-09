import { FullConfig, request } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const AUTH_STATE_ENV_PATH = 'PLAYWRIGHT_AUTH_STATE_PATH';
const AUTH_STATE_ENV_JSON = 'PLAYWRIGHT_AUTH_STATE_JSON';
const AUTH_FORCE_REFRESH = process.env.PLAYWRIGHT_AUTH_REFRESH === 'true';

function resolveBaseURL(config: FullConfig): string | undefined {
  for (const project of config.projects) {
    const candidate = (project.use as { baseURL?: string })?.baseURL;
    if (candidate) {
      return candidate;
    }
  }
  return process.env.BASE_URL;
}

export default async function globalSetup(config: FullConfig) {
  const authDir = path.resolve(__dirname, '.auth');
  await fs.mkdir(authDir, { recursive: true });

  const targetPath = path.join(authDir, 'default.json');
  const externalPath = process.env[AUTH_STATE_ENV_PATH];
  const inlineJson = process.env[AUTH_STATE_ENV_JSON];

  if (!AUTH_FORCE_REFRESH) {
    try {
      await fs.access(targetPath);
      return;
    } catch {
      // fall through to generation
    }
  }

  if (externalPath) {
    const sourcePath = path.resolve(externalPath);
    try {
      const data = await fs.readFile(sourcePath);
      await fs.writeFile(targetPath, data);
      return;
    } catch (error) {
      console.warn(`⚠️ Failed to copy storage state from ${sourcePath}:`, error);
    }
  }

  if (inlineJson) {
    try {
      await fs.writeFile(targetPath, inlineJson);
      return;
    } catch (error) {
      console.warn('⚠️ Failed to write storage state from inline JSON:', error);
    }
  }

  const baseURL = resolveBaseURL(config);

  if (!baseURL) {
    console.warn('⚠️ Playwright baseURL not configured; skipping automated auth bootstrap.');
    return;
  }

  const email = process.env.PLAYWRIGHT_AUTH_EMAIL ?? 'qa.manager@example.com';
  const password = process.env.PLAYWRIGHT_AUTH_PASSWORD ?? 'Playwright!123';
  const name = process.env.PLAYWRIGHT_AUTH_NAME ?? 'QA Manager';
  const phone = process.env.PLAYWRIGHT_AUTH_PHONE ?? '07123 456789';
  const apiKey = process.env.PLAYWRIGHT_TEST_API_KEY;

  const requestContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: apiKey ? { 'x-test-route-key': apiKey } : undefined,
  });

  try {
    const response = await requestContext.post('/api/test/playwright-session', {
      data: {
        email,
        password,
        profile: {
          name,
          phone,
          role: 'manager',
        },
      },
    });

    if (!response.ok()) {
      const bodyText = await response.text();
      console.warn(`⚠️ Failed to bootstrap auth session (${response.status()}): ${bodyText}`);
      return;
    }

    await requestContext.storageState({ path: targetPath });
  } catch (error) {
    console.warn('⚠️ Failed to generate storage state via test API:', error);
  } finally {
    await requestContext.dispose();
  }
}
