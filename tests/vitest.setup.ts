import '@testing-library/jest-dom';

// Basic fetch/polyfills for jsdom
// Node 20+ ships fetch/Request/Response globally; no external polyfill needed for jsdom

// Stub console.error in tests to reduce noise (can be adjusted per suite)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // allow failed assertions etc. to still surface
    if (typeof args[0] === 'string' && args[0].includes('[TEST-SILENCE]')) return;
    originalError(...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
