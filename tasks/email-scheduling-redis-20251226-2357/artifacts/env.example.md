# Email Queue Test Env (placeholders)

> Do **not** commit real secrets. Replace values locally or in your secrets manager.

```dotenv
# Enable queued email delivery
FEATURE_EMAIL_QUEUE_ENABLED=true

# Redis (BullMQ) connection
QUEUE_REDIS_URL=redis://<username>:<password>@<host>:<port>
# Use rediss:// if TLS is required:
# QUEUE_REDIS_URL=rediss://<username>:<password>@<host>:<port>
# Alternatively, use discrete fields:
# QUEUE_REDIS_HOST=<host>
# QUEUE_REDIS_PORT=<port>
# QUEUE_REDIS_USERNAME=<username>
# QUEUE_REDIS_PASSWORD=<password>
# QUEUE_REDIS_TLS=true

# Resend (email provider)
RESEND_API_KEY=re_<redacted>
RESEND_FROM="Your Brand <noreply@yourdomain.com>"
# Optional: use mock delivery in non-prod
# RESEND_USE_MOCK=true

# Supabase (service role for worker)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

## Notes

- Run the worker with: `pnpm queue:email-worker`
- The worker requires `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` to fetch bookings.
- Keep Redis credentials in your secret store; do not paste them into source or tickets.

## CLI test (placeholders)

```bash
redis-cli -u redis://<username>:<password>@<host>:<port>
```

## Node test (placeholders)

```ts
import { createClient } from 'redis';

const client = createClient({
  username: process.env.QUEUE_REDIS_USERNAME ?? 'default',
  password: process.env.QUEUE_REDIS_PASSWORD,
  socket: {
    host: process.env.QUEUE_REDIS_HOST,
    port: Number(process.env.QUEUE_REDIS_PORT ?? 6379),
    tls: process.env.QUEUE_REDIS_TLS === 'true',
  },
});

client.on('error', (err) => console.error('Redis Client Error', err));

await client.connect();
await client.set('foo', 'bar');
const result = await client.get('foo');
console.log(result);
```
