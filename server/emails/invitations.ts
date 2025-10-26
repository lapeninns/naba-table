import { format } from "date-fns";

import config from "@/config";
import { buildInviteUrl } from "@/lib/owner/team/invite-links";
import { sendEmail } from "@/libs/resend";
import { resolveInviteContext } from "@/server/team/invitations";

import type { RestaurantInvite } from "@/server/team/invitations";

function formatExpiry(timestamp: string): { date: string; time: string } {
  const date = new Date(timestamp);
  return {
    date: format(date, "EEEE, MMMM d, yyyy"),
    time: format(date, "HH:mm xxx"),
  };
}

export async function sendTeamInviteEmail(params: { invite: RestaurantInvite; token: string }): Promise<void> {
  const { invite, token } = params;
  const inviteUrl = buildInviteUrl(token);

  const { restaurantName, inviterName } = await resolveInviteContext(invite);
  const expiry = formatExpiry(invite.expires_at);

  const subject = `You're invited to join ${restaurantName} on SajiloReserveX`;
  const greeting = inviterName ? `${inviterName} has invited you` : "You're invited";

  const html = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #0f172a;">
      <h1 style="font-size: 20px; margin: 0 0 16px 0;">${greeting}</h1>
      <p style="margin: 0 0 16px;">
        Join <strong>${restaurantName}</strong> on SajiloReserveX and manage bookings with the team.
      </p>
      <p style="margin: 0 0 16px;">
        <strong>Your role:</strong> ${invite.role.charAt(0).toUpperCase()}${invite.role.slice(1)}
      </p>
      <p style="margin: 0 0 16px;">
        This invitation expires on <strong>${expiry.date}</strong> at <strong>${expiry.time}</strong>.
      </p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 20px; border-radius: 999px; text-decoration: none; font-weight: 600;">
          Accept invite
        </a>
      </p>
      <p style="margin: 0 0 16px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin: 0 0 16px; word-break: break-all;">
        <a href="${inviteUrl}" style="color: #2563eb;">${inviteUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid rgba(15, 23, 42, 0.1); margin: 32px 0;" />
      <p style="margin: 0; font-size: 12px; color: #64748b;">
        You received this message because ${restaurantName} wants to collaborate with you on SajiloReserveX.
        If you weren't expecting this invite, you can safely ignore it.
      </p>
    </div>
  `;

  const text = [
    `${greeting} to join ${restaurantName} on SajiloReserveX.`,
    `Your role: ${invite.role}`,
    `This invitation expires on ${expiry.date} at ${expiry.time}.`,
    `Accept the invite: ${inviteUrl}`,
    "",
    "If you were not expecting this invitation, you can ignore this email.",
  ].join("\n");

  await sendEmail({
    to: invite.email,
    subject,
    html,
    text,
    fromName: config.email.fromSupport ?? "SajiloReserveX",
  });
}
