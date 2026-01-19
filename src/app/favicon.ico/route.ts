export const runtime = 'nodejs';

export async function GET() {
  return new Response(new Uint8Array(), {
    status: 200,
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
