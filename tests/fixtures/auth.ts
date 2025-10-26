import { expect as baseExpect, test as base } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Page} from '@playwright/test';

const DEFAULT_STATE_PATH = path.resolve(__dirname, '../.auth/default.json');

export type ApiClient = {
  get<T>(url: string): Promise<T>;
  post<T>(url: string, data?: unknown): Promise<T>;
  delete<T>(url: string): Promise<T>;
};

export type AuthFixtures = {
  authedPage: Page;
  apiClient: ApiClient;
};

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ browser }, use, testInfo) => {
    try {
      await fs.access(DEFAULT_STATE_PATH);
    } catch {
      testInfo.skip(true, 'Storage state missing; provide PLAYWRIGHT_AUTH_STATE_PATH or PLAYWRIGHT_AUTH_STATE_JSON.');
      return;
    }

    const context = await browser.newContext({ storageState: DEFAULT_STATE_PATH });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  apiClient: async ({ request }, use) => {
    const client: ApiClient = {
      get: async <T>(url: string) => {
        const response = await request.get(url);
        if (!response.ok()) throw new Error(`GET ${url} failed: ${response.status()}`);
        return (await response.json()) as T;
      },
      post: async <T>(url: string, data?: unknown) => {
        const response = await request.post(url, { data });
        if (!response.ok()) throw new Error(`POST ${url} failed: ${response.status()}`);
        return (await response.json()) as T;
      },
      delete: async <T>(url: string) => {
        const response = await request.delete(url);
        if (!response.ok()) throw new Error(`DELETE ${url} failed: ${response.status()}`);
        return (await response.json()) as T;
      },
    };

    await use(client);
  },
});

export const expect = baseExpect;
