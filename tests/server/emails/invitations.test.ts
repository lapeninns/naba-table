import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn());
const recordEmailDeliveryLog = vi.hoisted(() => vi.fn());
const resolveInviteContext = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

vi.mock('@/config', () => ({
  default: {
    appName: 'Nab a Table',
    email: {
      platformReplyTo: 'support-replies@nabatable.com',
    },
  },
}));

vi.mock('@/lib/owner/team/invite-links', () => ({
  buildInviteUrl: (token: string) => `https://app.nabatable.com/invite/${token}`,
}));

vi.mock('@/libs/resend', () => ({
  sendEmail,
  isEmailRecipientSuppressedError: (_error: unknown) => false,
  createEmailIdempotencyKey: ({ scope, parts }: { scope: string; parts: unknown[] }) =>
    `${scope}:${parts.join(':')}`,
}));

vi.mock('@/server/emails/email-delivery-log', () => ({
  recordEmailDeliveryLog,
}));

vi.mock('@/server/team/invitations', () => ({
  resolveInviteContext,
}));

import { sendTeamInviteEmail } from '@/server/emails/invitations';

function buildInvite() {
  return {
    id: 'invite-1',
    restaurant_id: 'restaurant-1',
    email: 'manager@example.com',
    role: 'manager',
    expires_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-05-11T12:00:00.000Z',
  } as Parameters<typeof sendTeamInviteEmail>[0]['invite'];
}

describe('sendTeamInviteEmail', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    recordEmailDeliveryLog.mockReset();
    resolveInviteContext.mockReset();

    sendEmail.mockResolvedValue({ provider: 'mock', messageId: 'msg_invite' });
    recordEmailDeliveryLog.mockResolvedValue({ id: 'log-1' });
    resolveInviteContext.mockResolvedValue({
      restaurantName: 'The Venue',
      inviterName: 'Owner',
    });
  });

  it('uses the platform reply-to policy and support sender name', async () => {
    await sendTeamInviteEmail({ invite: buildInvite(), token: 'token-1' });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'manager@example.com',
        replyTo: 'support-replies@nabatable.com',
        fromName: 'Nab a Table Support',
      }),
    );
  });
});
