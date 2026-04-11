const gatewayUrl = process.env.CLOUDFLARE_SMS_SUMMARY_GATEWAY_URL;
const gatewayToken = process.env.CLOUDFLARE_SMS_SUMMARY_GATEWAY_TOKEN;
const restaurantId = process.env.SMS_BOOKING_SUMMARY_SMOKE_RESTAURANT_ID;
const date = process.env.SMS_BOOKING_SUMMARY_SMOKE_DATE;

async function main() {
  if (!gatewayUrl || !gatewayToken || !restaurantId) {
    throw new Error(
      'Set CLOUDFLARE_SMS_SUMMARY_GATEWAY_URL, CLOUDFLARE_SMS_SUMMARY_GATEWAY_TOKEN, and SMS_BOOKING_SUMMARY_SMOKE_RESTAURANT_ID.',
    );
  }

  const response = await fetch(`${gatewayUrl.replace(/\/+$/, '')}/internal/dispatch-daily-summary`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${gatewayToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      restaurantId,
      dryRun: true,
      ...(date ? { date } : {}),
    }),
  });

  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;

  if (!response.ok) {
    throw new Error(`Smoke request failed (${response.status}): ${raw}`);
  }

  const preview = body?.preview as { message?: unknown } | undefined;

  if (typeof preview?.message !== 'string' || preview.message.length === 0) {
    throw new Error(`Smoke response did not include a summary preview: ${raw}`);
  }

  console.log(JSON.stringify(body, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

export {};
