import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateLink = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({
    auth: {
      admin: {
        generateLink,
      },
    },
  }),
}));

vi.mock('@/libs/resend', () => ({
  sendEmail,
  createEmailIdempotencyKey: ({ scope, parts }: { scope: string; parts: unknown[] }) =>
    `${scope}:${parts.join(':')}`,
}));

vi.mock('@/lib/env', () => ({
  env: {
    app: {
      url: 'https://www.nabatable.com',
    },
  },
}));

vi.mock('@/config', () => ({
  default: {
    appName: 'Nab a Table',
    auth: {
      loginUrl: '/auth',
    },
    email: {
      supportEmail: 'support@nabatable.com',
    },
  },
}));

import { sendAuthMagicLink } from '@/server/auth/magic-link-email';

describe('sendAuthMagicLink', () => {
  beforeEach(() => {
    generateLink.mockReset();
    sendEmail.mockReset();
  });

  it('generates a magic link and sends it via resend', async () => {
    generateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://supabase.example/auth/v1/verify?token_hash=abc&type=magiclink',
          verification_type: 'magiclink',
        },
      },
      error: null,
    });
    sendEmail.mockResolvedValue({ provider: 'mock', messageId: 'msg_1' });

    await sendAuthMagicLink({
      email: 'guest@example.com',
      emailRedirectTo: 'https://www.nabatable.com/api/auth/callback?redirectedFrom=%2Fguest',
      intent: 'signin',
    });

    expect(generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'guest@example.com',
      options: {
        redirectTo: 'https://www.nabatable.com/api/auth/callback?redirectedFrom=%2Fguest',
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@example.com',
      }),
    );
  });

  it('surfaces Supabase link generation failures', async () => {
    generateLink.mockResolvedValue({
      data: null,
      error: {
        status: 429,
        message: 'rate limited',
      },
    });

    await expect(
      sendAuthMagicLink({
        email: 'guest@example.com',
        emailRedirectTo: 'https://www.nabatable.com/api/auth/callback',
        intent: 'signin',
      }),
    ).rejects.toMatchObject({
      name: 'MagicLinkDeliveryError',
      status: 429,
      reason: 'generate_link_failed',
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('fails fast when Supabase response has no action link', async () => {
    generateLink.mockResolvedValue({
      data: {
        properties: {
          verification_type: 'magiclink',
        },
      },
      error: null,
    });

    await expect(
      sendAuthMagicLink({
        email: 'guest@example.com',
        emailRedirectTo: 'https://www.nabatable.com/api/auth/callback',
        intent: 'signup',
      }),
    ).rejects.toMatchObject({
      name: 'MagicLinkDeliveryError',
      status: 500,
      reason: 'invalid_link_payload',
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
