import React from "react";

process.env.NODE_ENV = "test";

// Ensure React is available globally for components compiled with the automatic runtime.
// @ts-expect-error: allow setting React on the global object for test environment
globalThis.React = React;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}
if (!process.env.NEXT_PUBLIC_APP_URL) {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
}
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
}
if (!process.env.BASE_URL) {
  process.env.BASE_URL = "http://localhost:3000";
}
process.env.ENABLE_TEST_API = "true";
