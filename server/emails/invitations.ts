import { format } from "date-fns";
import { createHash } from "node:crypto";

import { buildInviteUrl } from "@/lib/owner/team/invite-links";
import {
  createEmailIdempotencyKey,
  isEmailRecipientSuppressedError,
  sendEmail,
} from "@/libs/resend";
import {
  COLORS,
  renderButton,
  renderDivider,
  renderEmailBase,
  escapeHtml,
  EMAIL_FONT_STACK,
} from "@/server/emails/base";
import { recordEmailDeliveryLog } from "@/server/emails/email-delivery-log";
import {
  resolvePlatformReplyTo,
  resolvePlatformSupportSenderName,
} from "@/server/emails/sender-policy";
import { resolveInviteContext } from "@/server/team/invite-context";

import type { RestaurantInvite } from "@/server/team/invite-types";

function formatExpiry(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp);
  return {
    date: format(date, "EEEE, MMMM d, yyyy"),
    time: format(date, "HH:mm xxx"),
  };
}

function buildTeamInviteIdempotencyKey(params: { inviteId: string; email: string; updatedAt: string | null }) {
  const digest = createHash("sha256")
    .update([params.inviteId, params.email, params.updatedAt ?? ""].join("|"))
    .digest("hex")
    .slice(0, 16);

  return createEmailIdempotencyKey({
    scope: "team-invite",
    parts: [params.inviteId, digest],
  });
}

export async function sendTeamInviteEmail(params: { invite: RestaurantInvite; token: string }): Promise<void> {
  const { invite, token } = params;
  const inviteUrl = buildInviteUrl(token);

  const { restaurantName, inviterName } = await resolveInviteContext(invite);
  const expiry = formatExpiry(invite.expires_at);

  const subject = `You're invited to join ${restaurantName} on Nab a Table`;
  const greeting = inviterName ? `${inviterName} has invited you` : "You're invited";

  const title = `${greeting}`;
  const preheader = `Join ${restaurantName} on Nab a Table. Role: ${invite.role}. Expires ${expiry.date} ${expiry.time}`;

  const contentHtml = `
    <div style="text-align:center;">
      <h1 style="margin:0 0 16px;font-family:${EMAIL_FONT_STACK};font-size:24px;font-weight:700;color:${COLORS.brand};line-height:1.3;">${escapeHtml(greeting)}</h1>
      <p style="margin:0 0 24px;font-family:${EMAIL_FONT_STACK};font-size:16px;color:${COLORS.text};line-height:1.6;">
        Join <strong>${escapeHtml(restaurantName)}</strong> on Nab a Table and manage bookings with the team.
      </p>
      
      <div style="background:${COLORS.gridBg};padding:24px;border-radius:12px;margin-bottom:24px;text-align:left;border:1px solid ${COLORS.border};">
        <p style="margin:0 0 8px;font-family:${EMAIL_FONT_STACK};font-size:14px;color:${COLORS.text};">
          <strong>Role:</strong> ${escapeHtml(invite.role.charAt(0).toUpperCase() + invite.role.slice(1))}
        </p>
        <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:14px;color:${COLORS.text};">
          <strong>Expires:</strong> ${escapeHtml(expiry.date)} at ${escapeHtml(expiry.time)}
        </p>
      </div>

      ${renderButton('Accept Invite', inviteUrl)}
      
      <p style="margin:24px 0 0;font-family:${EMAIL_FONT_STACK};font-size:13px;color:${COLORS.muted};">
        If the button doesn't work, copy and paste this link:
      </p>
      <p style="margin:4px 0 0;font-family:${EMAIL_FONT_STACK};font-size:13px;word-break:break-all;">
        <a href="${inviteUrl}" style="color:${COLORS.brand};text-decoration:none;">${inviteUrl}</a>
      </p>

      ${renderDivider()}

      <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:12px;color:${COLORS.text};line-height:1.5;">
        You received this because <strong>${escapeHtml(restaurantName)}</strong> wants to collaborate with you on Nab a Table. If you weren't expecting this invite, you can ignore it.
      </p>
    </div>
  `;

  const html = renderEmailBase({ title, preheader, contentHtml });

  const text = [
    `${greeting} to join ${restaurantName} on Nab a Table.`,
    `Your role: ${invite.role}`,
    `This invitation expires on ${expiry.date} at ${expiry.time}.`,
    `Accept the invite: ${inviteUrl}`,
    "",
    "If you were not expecting this invitation, you can ignore this email.",
  ].join("\n");

  let result;

  try {
    result = await sendEmail({
      to: invite.email,
      subject,
      html,
      text,
      category: 'team_invitation',
      replyTo: resolvePlatformReplyTo(),
      fromName: resolvePlatformSupportSenderName(),
      tags: [
        { name: "email_type", value: "team_invite" },
        { name: "template_type", value: "team_invite" },
        { name: "restaurant_id", value: invite.restaurant_id ?? "unknown" },
      ],
      idempotencyKey: buildTeamInviteIdempotencyKey({
        inviteId: invite.id,
        email: invite.email,
        updatedAt: invite.updated_at,
      }),
    });
  } catch (error) {
    if (isEmailRecipientSuppressedError(error)) {
      console.warn("[emails][invitations] recipient suppressed; skipping invite email", {
        inviteId: invite.id,
      });
      return;
    }

    throw error;
  }

  await recordEmailDeliveryLog({
    restaurantId: invite.restaurant_id ?? null,
    emailType: "team_invite",
    templateType: "team_invite",
    recipientEmail: invite.email,
    messageId: result.messageId,
    status: "sent",
    provider: result.provider,
    metadata: {
      role: invite.role,
    },
  });
}
