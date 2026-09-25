import { isMissingOrPlaceholder } from "../env";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  delivered: boolean;
  messageId: string | null;
  /** "sent" | "stubbed" | "failed" — callers should persist this in EmailLog.status */
  status: "sent" | "stubbed" | "failed";
  error?: string;
}

export function isEmailConfigured(): boolean {
  return !isMissingOrPlaceholder(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    "Racana <books@racana.studio>";

  if (!isEmailConfigured()) {
    console.warn(
      `[Email] RESEND_API_KEY missing — email to ${input.to} ("${input.subject}") NOT delivered.`
    );
    return { delivered: false, messageId: null, status: "stubbed" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result: any = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (result?.error) {
      return {
        delivered: false,
        messageId: null,
        status: "failed",
        error: result.error.message || "Resend API error",
      };
    }
    return { delivered: true, messageId: result?.id || null, status: "sent" };
  } catch (err) {
    return {
      delivered: false,
      messageId: null,
      status: "failed",
      error: (err as Error).message,
    };
  }
}
