/**
 * Vitest Global Setup
 *
 * This file runs before all tests to set up the test environment.
 */

import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.APP_ENV = 'test';
});

// Clean up after each test
afterEach(() => {
  // Reset any mocks
});

// Global teardown
afterAll(() => {
  // Clean up any resources
});
