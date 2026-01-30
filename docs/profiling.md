# Profiling

This repo does not run continuous profiling by default.

## On-demand CPU profile (local)

You can generate a Node.js CPU profile for a production-like run:

```bash
mkdir -p tasks/local-profiling/artifacts
NODE_OPTIONS='--cpu-prof --cpu-prof-dir=./tasks/local-profiling/artifacts' pnpm start
```

Then reproduce the slow path, stop the server, and open the generated `*.cpuprofile` file in Chrome DevTools:

1. Chrome DevTools → Performance
2. Load profile

## Notes

- Profiling can contain sensitive data in stack traces. Treat profiles as internal artifacts.
- Prefer profiling in staging with non-production data when possible.
