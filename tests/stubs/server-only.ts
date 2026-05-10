// Vitest stub for Next.js's `server-only` marker module.
// At runtime this import is a no-op that exists purely to make webpack/turbopack
// fail the build if a file marked `server-only` is ever bundled into client code.
// In vitest we don't care: just provide an empty module so imports resolve.
export {};
