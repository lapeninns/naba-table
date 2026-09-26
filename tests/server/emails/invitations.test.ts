import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn());
const recordEmailDeliveryLog = vi.hoisted(() => vi.fn());
const resolveInviteContext = vi.hoisted(() => vi.fn());
const isSuppressed = vi.hoisted(() => vi.fn((_error: unknown) => false));
const loggerWarn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({
  logger: { warn: loggerWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('server-only', () => ({}));

vi.mock('@/config', () => ({
  default: {
    appName: 'Nab a Table',
    email: {
      platformReplyTo: 'support-replies@nabatable.com',
    },
  },
}));

vi.mock('@/lib/site-url', () => ({
  getTrustedSiteOrigin: () => 'https://www.nabatable.com',
}));

vi.mock('@/libs/resend', () => ({
  sendEmail,
  isEmailRecipientSuppressedError: isSuppressed,
  createEmailIdempotencyKey: ({ scope, parts }: { scope: string; parts: unknown[] }) =>
    `${scope}:${parts.join(':')}`,
}));

vi.mock('@/server/emails/email-delivery-log', () => ({
  recordEmailDeliveryLog,
}));

vi.mock('@/server/team/invite-context', () => ({
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
    isSuppressed.mockReset().mockReturnValue(false);
    loggerWarn.mockReset();

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

  it('uses the public root host for invite acceptance links', async () => {
    await sendTeamInviteEmail({ invite: buildInvite(), token: 'token-1' });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('https://www.nabatable.com/invite/token-1'),
        text: expect.stringContaining('https://www.nabatable.com/invite/token-1'),
      }),
    );
  });

  it('reports a delivered email', async () => {
    await expect(sendTeamInviteEmail({ invite: buildInvite(), token: 'token-1' })).resolves.toEqual({
      delivered: true,
    });
  });

  it('reports a suppressed recipient as not delivered and logs without the address', async () => {
    const suppressed = new Error('suppressed');
    sendEmail.mockRejectedValue(suppressed);
    isSuppressed.mockImplementation((error: unknown) => error === suppressed);

    await expect(sendTeamInviteEmail({ invite: buildInvite(), token: 'token-1' })).resolves.toEqual({
      delivered: false,
    });
    expect(recordEmailDeliveryLog).not.toHaveBeenCalled();
    expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain('manager@example.com');
  });

  it('rethrows provider failures so the caller can report them', async () => {
    sendEmail.mockRejectedValue(new Error('provider down'));

    await expect(sendTeamInviteEmail({ invite: buildInvite(), token: 'token-1' })).rejects.toThrow(
      'provider down',
    );
  });
});
