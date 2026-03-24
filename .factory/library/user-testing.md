# User Testing

Testing surface, required testing skills/tools, resource cost classification per surface.

---

## Validation Surface

- **Primary surface**: Browser at `http://app.localhost:3000/email-delivery`
- **Tool**: agent-browser (headless Chromium)
- **Authentication**: Password login at `http://app.localhost:3000/auth/signin`
  - Email: `oldcrown@lapeninns.com`
  - Password: `OldCrown@2025`
- **Dev harness**: `http://localhost:3000/dev/ops-email-delivery` (no auth required, uses mock data)
- **Dev server**: Already running on port 3000 (`pnpm dev`)

## Validation Concurrency

- Machine: 64GB RAM, 18 CPU cores, ~30GB free headroom
- Per agent-browser instance: ~300MB RAM
- Dev server: ~200MB RAM (shared, already running)
- Max concurrent validators: **5** (5 × 300MB = 1.5GB, well within 70% of 30GB = 21GB budget)
