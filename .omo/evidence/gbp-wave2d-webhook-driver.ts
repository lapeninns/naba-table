import { handleGoogleBusinessProfilePush } from '../../server/dual-sync/pubsub/handler';

const config = {
  enabled: true,
  expectedAudience: 'https://example.test/api/webhooks/google-business-profile/pubsub',
  pushServiceAccountEmail: 'push@example.iam.gserviceaccount.com',
  subscription: 'projects/example/subscriptions/gbp',
} as const;

function request(input: { readonly subscription?: string; readonly body?: string }): Request {
  const data = Buffer.from(
    JSON.stringify({
      type: 'GOOGLE_UPDATE',
      accountName: 'accounts/account-1',
      locationName: 'locations/location-1',
    }),
  ).toString('base64');
  return new Request(config.expectedAudience, {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
    body:
      input.body ??
      JSON.stringify({
        message: { data, messageId: 'message-1' },
        subscription: input.subscription ?? config.subscription,
      }),
  });
}

function requireStatus(name: string, actual: number, expected: number): void {
  if (actual !== expected) throw new Error(`${name}: expected ${expected}, received ${actual}`);
}

const cases = [
  {
    name: 'invalid authentication',
    expected: 401,
    run: () =>
      handleGoogleBusinessProfilePush(request({}), config, {
        authenticate: async () => ({ ok: false, reason: 'invalid_token' }),
        persist: async () => ({ outcome: 'accepted' }),
      }),
  },
  {
    name: 'claim mismatch',
    expected: 403,
    run: () =>
      handleGoogleBusinessProfilePush(request({}), config, {
        authenticate: async () => ({ ok: false, reason: 'claim_mismatch' }),
        persist: async () => ({ outcome: 'accepted' }),
      }),
  },
  {
    name: 'subscription mismatch',
    expected: 403,
    run: () =>
      handleGoogleBusinessProfilePush(
        request({ subscription: 'projects/attacker/subscriptions/other' }),
        config,
        {
          authenticate: async () => ({ ok: true }),
          persist: async () => ({ outcome: 'accepted' }),
        },
      ),
  },
  {
    name: 'actual oversize',
    expected: 413,
    run: () =>
      handleGoogleBusinessProfilePush(request({ body: 'x'.repeat(65_537) }), config, {
        authenticate: async () => ({ ok: true }),
        persist: async () => ({ outcome: 'accepted' }),
      }),
  },
  {
    name: 'authenticated malformed envelope',
    expected: 204,
    run: () =>
      handleGoogleBusinessProfilePush(request({ body: '{invalid-json' }), config, {
        authenticate: async () => ({ ok: true }),
        persist: async () => ({ outcome: 'accepted' }),
      }),
  },
  {
    name: 'transient persistence failure',
    expected: 500,
    run: () =>
      handleGoogleBusinessProfilePush(request({}), config, {
        authenticate: async () => ({ ok: true }),
        persist: async () => {
          throw new Error('transient');
        },
      }),
  },
] as const;

async function main(): Promise<void> {
  const results = [];
  for (const scenario of cases) {
    const response = await scenario.run();
    requireStatus(scenario.name, response.status, scenario.expected);
    if (response.headers.get('cdn-cache-control') !== 'no-store') {
      throw new Error(`${scenario.name}: missing CDN no-store`);
    }
    results.push({ scenario: scenario.name, status: response.status });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
}

void main();
