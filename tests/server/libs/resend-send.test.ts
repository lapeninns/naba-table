import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateEmailResponse } from "resend";

const sendMock = vi.fn<(payload: Record<string, unknown>) => Promise<CreateEmailResponse>>();

vi.mock("@/lib/env", () => ({
  env: {
    resend: {
      apiKey: "test-resend-key",
      from: "noreply@example.com",
    },
    node: {
      env: "test",
    },
  },
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}));

process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.com";

const { sendEmail } = await import("@/libs/resend");

describe("sendEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  const basePayload = {
    to: "user@example.com",
    subject: "Hello",
    html: "<p>Hello</p>",
  } as const;

  it("throws when the Resend API responds with an error object", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        name: "invalid_from_address",
        message: "Domain missing",
      },
    });

    await expect(sendEmail(basePayload)).rejects.toThrow(
      /Resend API error \(invalid_from_address\): Domain missing/,
    );
  });

  it("throws when the API response omits an email id", async () => {
    sendMock.mockResolvedValue({
      data: { id: undefined as unknown as string },
      error: null,
    } as unknown as CreateEmailResponse);

    await expect(sendEmail(basePayload)).rejects.toThrow(/Resend API error \(missing_id\)/);
  });
});
