import { format } from "date-fns";

import config from "@/config";
import { buildInviteUrl } from "@/lib/owner/team/invite-links";
import { sendEmail } from "@/libs/resend";
import { renderButton, renderEmailBase, escapeHtml } from "@/server/emails/base";
import { resolveInviteContext } from "@/server/team/invitations";

import type { RestaurantInvite } from "@/server/team/invitations";

function extractDisplayName(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

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

  const title = `${greeting}`;
  const preheader = `Join ${restaurantName} on SajiloReserveX. Role: ${invite.role}. Expires ${expiry.date} ${expiry.time}`;
  const contentHtml = `
    <div class="card">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:24px 24px 8px;">
            <h1 style="margin:0 0 8px;font-size:22px;line-height:1.35;color:#0f172a;">${escapeHtml(greeting)}</h1>
            <p style="margin:0 0 12px;font-size:15px;color:#334155;">Join <strong>${escapeHtml(restaurantName)}</strong> on SajiloReserveX and manage bookings with the team.</p>
            <p style="margin:0 0 12px;font-size:14px;color:#475569;"><strong>Your role:</strong> ${escapeHtml(invite.role.charAt(0).toUpperCase() + invite.role.slice(1))}</p>
            <p style="margin:0 0 16px;font-size:14px;color:#475569;">This invitation expires on <strong>${escapeHtml(expiry.date)}</strong> at <strong>${escapeHtml(expiry.time)}</strong>.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:8px 24px 16px;">
            ${renderButton('Accept invite', inviteUrl, { variant: 'primary', align: 'center' })}
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 24px;">
            <p style="margin:0 0 8px;font-size:12px;color:#64748b;">If the button doesn't work, copy and paste this link:</p>
            <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${inviteUrl}" style="color:#4338ca;text-decoration:none;">${inviteUrl}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 24px;">
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
            <p style="margin:0;font-size:12px;color:#64748b;">You received this because ${escapeHtml(restaurantName)} wants to collaborate with you on SajiloReserveX. If you weren't expecting this invite, you can ignore it.</p>
          </td>
        </tr>
      </table>
    </div>`;

  const html = renderEmailBase({ title, preheader, contentHtml });

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
    fromName: extractDisplayName(config.email.fromSupport) ?? "SajiloReserveX",
  });
}
