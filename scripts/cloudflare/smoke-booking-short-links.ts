const baseUrl =
  process.env.BOOKING_SHORT_LINKS_INTERNAL_URL ??
  'https://nabatable-booking-short-links.amanshresthaaaaa.workers.dev';

async function main() {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/health`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Health check failed (${response.status}): ${text}`);
  }

  console.log(text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

export {};
