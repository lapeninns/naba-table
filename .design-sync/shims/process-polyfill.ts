// Preview-time process polyfill. App config/analytics modules (pulled in
// transitively by some components) read process.env.* at module-eval time —
// Next inlines these at build, but in the static preview bundle `process` is
// undefined and every component would throw `process is not defined`.
//
// Imported FIRST in the barrel (.design-sync/entry.tsx) so it runs before any
// component module evaluates. env is a Proxy returning '' for unknown keys so
// `process.env.X.split(...)`-style reads don't crash the render either.
const g = globalThis as unknown as { process?: { env?: Record<string, string> } };
if (!g.process) g.process = {};
// Non-secret preview placeholders. lib/env-client.ts assertEnv()s the two
// SUPABASE_* vars (throws if empty); the rest just give sensible non-empty
// values so any component reading them renders realistically.
const seed: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://preview.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'preview-anon-key',
  NEXT_PUBLIC_ROOT_DOMAIN: 'nabatable.com',
  NEXT_PUBLIC_SITE_URL: 'https://nabatable.com',
  NEXT_PUBLIC_APP_VERSION: '0.0.0-preview',
  ...(g.process.env || {}),
};
g.process.env = new Proxy(seed, {
  get: (target, key) => (typeof key === 'string' && key in target ? target[key] : ''),
});
