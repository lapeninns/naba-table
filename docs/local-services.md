# Local Services

This repo is **Supabase remote-only**. Do not run a local Supabase stack for this project.

## Redis (optional)

The app uses Redis for queues/caching in some deployments. For local development, you can run Redis via Docker:

```bash
docker compose up -d redis
```

Defaults:

- Host: `localhost`
- Port: `6379`

Stop:

```bash
docker compose down
```
