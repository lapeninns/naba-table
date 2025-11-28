# Auth Email Templates (Supabase)

_Last updated: 2025-11-28 · Brand: Nab a Table (Lapen Inns)_

Scope: Confirm sign up · Invite user · Magic link · Change email address · Reset password · Reauthentication.

## How to use

- Paste the **HTML** into Supabase Dashboard → Authentication → Email Templates → HTML. Paste the matching **Plain text** into the plain text tab.
- Keep every `{{ ... }}` placeholder intact; Supabase replaces these at send time.
- Links and codes expire based on your Supabase Auth settings. Avoid hard‑coding a duration unless you update those settings accordingly.
- Send a test from the dashboard before enabling in production to verify branding, links, and spam score.

## Quick variables (Supabase)

| Variable                 | What Supabase injects                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `{{ .ConfirmationURL }}` | Full action link for the flow (signup, invite, magic link, reset, change email, reauth). |
| `{{ .Token }}`           | Six‑digit OTP alternative to the link (reauth/reset also support this).                  |
| `{{ .TokenHash }}`       | Hashed token (only needed if you build a custom link).                                   |
| `{{ .SiteURL }}`         | App base URL from Auth settings.                                                         |
| `{{ .RedirectTo }}`      | Redirect target passed from your app (kept in the link).                                 |
| `{{ .Email }}`           | Current email on the account.                                                            |
| `{{ .NewEmail }}`        | New email for the change-email flow.                                                     |
| `{{ .Data }}`            | User metadata (use if you populate names/venues).                                        |

## Styling notes

- Accent color: `#0B6E4F` (hospitality green); text: `#0F172A`; background: `#F7F8F6`.
- Buttons use rounded corners and generous padding for touch targets.
- Footer reminds users how to get help and what to do if they did not initiate the action.

---

### Confirm sign up

- **Subject**: Confirm your Nab a Table account
- **Preview**: One tap to finish setting up your reservation profile.

#### HTML

```html
<!doctype html>
<html>
  <body
    style="margin:0;padding:0;background:#F7F8F6;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;"
  >
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="600"
            style="max-width:600px;background:#ffffff;border-radius:14px;border:1px solid #E2E8F0;padding:32px;"
          >
            <tr>
              <td style="font-size:18px;font-weight:700;">Welcome to Nab a Table</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:15px;line-height:22px;">
                Hi {{ .Email }}, thanks for joining. Confirm your email to finish setting up your
                profile and start taking bookings.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0;">
                <a
                  href="{{ .ConfirmationURL }}"
                  style="display:inline-block;background:#0B6E4F;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:600;"
                  >Confirm my email</a
                >
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:20px;color:#475569;">
                If the button doesn’t work, copy and paste this link into your browser:<br /><span
                  style="word-break:break-all;"
                  >{{ .ConfirmationURL }}</span
                >
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-size:13px;line-height:20px;color:#475569;">
                If you didn’t try to create an account, you can ignore this message and no changes
                will be made.
              </td>
            </tr>
            <tr>
              <td style="padding-top:20px;font-size:12px;line-height:18px;color:#94A3B8;">
                Need help? Reply to this email or reach our team.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

#### Plain text

```text
Hi {{ .Email }},

Thanks for joining Nab a Table. Confirm your email to finish creating your account:
{{ .ConfirmationURL }}

If you didn’t request this, you can ignore this email.
```

#### Notes

- Uses `{{ .ConfirmationURL }}`; Supabase sets the expiry based on your Auth configuration.

---

### Invite user

- **Subject**: You’re invited to Nab a Table
- **Preview**: Join your team and manage reservations together.

#### HTML

```html
<!doctype html>
<html>
  <body
    style="margin:0;padding:0;background:#F7F8F6;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;"
  >
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="600"
            style="max-width:600px;background:#ffffff;border-radius:14px;border:1px solid #E2E8F0;padding:32px;"
          >
            <tr>
              <td style="font-size:18px;font-weight:700;">You’ve been invited</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:15px;line-height:22px;">
                Hi {{ .Email }}, a teammate set up an account for you on Nab a Table. Confirm to
                activate your access.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0;">
                <a
                  href="{{ .ConfirmationURL }}"
                  style="display:inline-block;background:#0B6E4F;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:600;"
                  >Accept invitation</a
                >
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:20px;color:#475569;">
                If the button doesn’t work, copy this link:<br /><span style="word-break:break-all;"
                  >{{ .ConfirmationURL }}</span
                >
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-size:13px;line-height:20px;color:#475569;">
                Not expecting this? You can safely ignore it; the invite will expire.
              </td>
            </tr>
            <tr>
              <td style="padding-top:20px;font-size:12px;line-height:18px;color:#94A3B8;">
                Questions? Reply to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

#### Plain text

```text
Hi {{ .Email }},

You were invited to Nab a Table. Activate your account:
{{ .ConfirmationURL }}

If you weren’t expecting this, ignore the email.
```

#### Notes

- Uses the invite confirmation link supplied by Supabase.

---

### Magic link

- **Subject**: Your magic link to sign in
- **Preview**: One click and you’re back to managing bookings.

#### HTML

```html
<!doctype html>
<html>
  <body
    style="margin:0;padding:0;background:#F7F8F6;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;"
  >
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="600"
            style="max-width:600px;background:#ffffff;border-radius:14px;border:1px solid #E2E8F0;padding:32px;"
          >
            <tr>
              <td style="font-size:18px;font-weight:700;">Sign in securely</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:15px;line-height:22px;">
                Hi {{ .Email }}, here’s your one-time magic link. Click to sign in instantly.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0;">
                <a
                  href="{{ .ConfirmationURL }}"
                  style="display:inline-block;background:#0B6E4F;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:600;"
                  >Sign me in</a
                >
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:20px;color:#475569;">
                Link not clickable? Copy and paste:<br /><span style="word-break:break-all;"
                  >{{ .ConfirmationURL }}</span
                >
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-size:13px;line-height:20px;color:#475569;">
                This link is single-use. If you didn’t request it, ignore this message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

#### Plain text

```text
Hi {{ .Email }},

Use this magic link to sign in:
{{ .ConfirmationURL }}

This link is single-use. If you didn’t request it, ignore this email.
```

#### Notes

- Works for passwordless sign-in; Supabase handles expiry and redirect.

---

### Change email address

- **Subject**: Confirm your new email for Nab a Table
- **Preview**: We’re ready to move your account to {{ .NewEmail }}.

#### HTML

```html
<!doctype html>
<html>
  <body
    style="margin:0;padding:0;background:#F7F8F6;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;"
  >
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="600"
            style="max-width:600px;background:#ffffff;border-radius:14px;border:1px solid #E2E8F0;padding:32px;"
          >
            <tr>
              <td style="font-size:18px;font-weight:700;">Confirm your new email</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:15px;line-height:22px;">
                You asked to move your Nab a Table account from <strong>{{ .Email }}</strong> to
                <strong>{{ .NewEmail }}</strong>. Click below to confirm.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0;">
                <a
                  href="{{ .ConfirmationURL }}"
                  style="display:inline-block;background:#0B6E4F;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:600;"
                  >Confirm new email</a
                >
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:20px;color:#475569;">
                If the button doesn’t work, paste this link:<br /><span
                  style="word-break:break-all;"
                  >{{ .ConfirmationURL }}</span
                >
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-size:13px;line-height:20px;color:#475569;">
                Didn’t request this change? Keep using your current email—no update will occur.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

#### Plain text

```text
You requested to change your Nab a Table email from {{ .Email }} to {{ .NewEmail }}.

Confirm here:
{{ .ConfirmationURL }}

If this wasn’t you, ignore this email to keep your current address.
```

#### Notes

- Works for secure email change flows; Supabase injects the correct link/token depending on whether the message goes to the old or new address.

---

### Reset password

- **Subject**: Reset your Nab a Table password
- **Preview**: Choose a new password with the link or code inside.

#### HTML

```html
<!doctype html>
<html>
  <body
    style="margin:0;padding:0;background:#F7F8F6;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;"
  >
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="600"
            style="max-width:600px;background:#ffffff;border-radius:14px;border:1px solid #E2E8F0;padding:32px;"
          >
            <tr>
              <td style="font-size:18px;font-weight:700;">Reset your password</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:15px;line-height:22px;">
                We received a request to reset the password for {{ .Email }}.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0;">
                <a
                  href="{{ .ConfirmationURL }}"
                  style="display:inline-block;background:#0B6E4F;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:600;"
                  >Choose a new password</a
                >
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:20px;color:#475569;">
                Prefer a code? Use this OTP: <strong>{{ .Token }}</strong>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:20px;color:#475569;">
                If you didn’t request this, you can ignore the email and your password stays the
                same.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

#### Plain text

```text
We received a request to reset the password for {{ .Email }}.

Reset link: {{ .ConfirmationURL }}
Or enter this OTP: {{ .Token }}

If you didn’t request this, ignore the message.
```

#### Notes

- Both link and OTP are supplied by Supabase; whichever is used first will complete the reset.

---

### Reauthentication

- **Subject**: Confirm it’s you to continue
- **Preview**: Enter the code below to finish your sensitive action.

#### HTML

```html
<!doctype html>
<html>
  <body
    style="margin:0;padding:0;background:#F7F8F6;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F172A;"
  >
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="600"
            style="max-width:600px;background:#ffffff;border-radius:14px;border:1px solid #E2E8F0;padding:32px;"
          >
            <tr>
              <td style="font-size:18px;font-weight:700;">Please verify it’s you</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-size:15px;line-height:22px;">
                Before we continue, confirm this action for {{ .Email }}.
              </td>
            </tr>
            <tr>
              <td
                align="center"
                style="padding:18px 0;font-size:22px;font-weight:700;letter-spacing:4px;color:#0B6E4F;"
              >
                {{ .Token }}
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:20px;color:#475569;">
                Enter this code in the app to proceed. It will expire shortly for your security.
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-size:13px;line-height:20px;color:#475569;">
                Didn’t request this? Ignore the code—no action will be taken.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

#### Plain text

```text
To continue with your action for {{ .Email }}, enter this code:
{{ .Token }}

It expires soon for security. If you didn’t initiate this, ignore the message.
```

#### Notes

- Reauthentication uses the OTP `{{ .Token }}` provided by Supabase for sensitive operations.

---

## Operational reminders

- Keep sender identity consistent with `docs/environments.md` (Resend SMTP configuration).
- If you later switch to secure email change, remember Supabase will send two messages (old and new email); this template works for both because it includes both addresses.
- After pasting templates, run a dashboard test to confirm the redirect URLs (`{{ .RedirectTo }}`) are allowed in Auth settings.
