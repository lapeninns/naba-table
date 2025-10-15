import React from 'react';
import '@testing-library/jest-dom/vitest';

// Some shared UI primitives reference React types at runtime when compiled in tests.
// Ensure React is available on the global scope for legacy components.
(globalThis as unknown as { React?: typeof React }).React = React;

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-role-key';
process.env.RESEND_API_KEY ??= 'test-resend-key';
process.env.RESEND_FROM ??= 'notifications@example.com';
process.env.BASE_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
