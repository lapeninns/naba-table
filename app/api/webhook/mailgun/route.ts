import { NextResponse, NextRequest } from "next/server";
import { sendEmail } from "@/libs/resend";
import config from "@/config";

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// This route is used to receive emails from Mailgun and forward them to our customer support email.
// Updated to use Resend instead of Mailgun for sending forwarded emails
// See more: https://shipfa.st/docs/features/emails
export async function POST(req: NextRequest) {
  try {
    // extract the email content, subject and sender
    const formData = await req.formData();
    const sender = formData.get("From");
    const subject = formData.get("Subject");
    const html = formData.get("body-html");

    // send email to the admin if forwardRepliesTo is set & emailData exists
    if (config.mailgun.forwardRepliesTo && html && subject && sender) {
      await sendEmail({
        to: config.mailgun.forwardRepliesTo,
        subject: `${config?.appName} | ${subject}`,
        html: `<div><p><b>- Subject:</b> ${subject}</p><p><b>- From:</b> ${sender}</p><p><b>- Content:</b></p><div>${html}</div></div>`,
        replyTo: String(sender),
      });
    }

    return NextResponse.json({});
  } catch (error: unknown) {
    const message = stringifyError(error);
    console.error(message);
    return NextResponse.json({ error: message || "Failed to handle webhook" }, { status: 500 });
  }
}
