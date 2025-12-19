// import fetch from 'node-fetch';

const baseUrl = process.env.OPS_QA_BASE_URL ?? 'http://localhost:3000';
const email = process.env.OPS_QA_EMAIL;

if (!email) {
  console.error('Missing OPS_QA_EMAIL. Set it in your environment and re-run.');
  console.error('Example: OPS_QA_EMAIL="qa@example.com" node trigger-signin.mjs');
  process.exit(1);
}

async function triggerSignin() {
  console.log(`Triggering signin for ${email}...`);

  try {
    const response = await fetch(`${baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'test-token',
        Cookie: 'sr-csrf-token=test-token',
      },
      body: JSON.stringify({
        email,
        mode: 'magic_link',
      }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    console.log('Response status:', response.status);

    if (!data || typeof data !== 'object') {
      console.log('Response body: <non-json>');
      return;
    }

    const redacted = { ...data };
    for (const key of [
      'url',
      'link',
      'magicLink',
      'token',
      'access_token',
      'refresh_token',
      'session',
    ]) {
      if (key in redacted) redacted[key] = '[REDACTED]';
    }

    console.log('Response body (redacted):', redacted);
  } catch (error) {
    console.error('Error:', error);
  }
}

triggerSignin();
