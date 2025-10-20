import { describe, expect, it, vi } from "vitest";

import { main, parseArgs, runDiagnostics, type ParsedArgs } from "@/scripts/email/check-resend-status";

describe("parseArgs", () => {
  it("parses --to and default limit", () => {
    const result = parseArgs(["--to", "user@example.com"]);
    expect(result).toEqual({ to: "user@example.com", limit: 5, json: false });
  });

  it("accepts positional email when flag omitted", () => {
    const result = parseArgs(["user@example.com", "--limit", "3"]);
    expect(result).toEqual({ to: "user@example.com", limit: 3, json: false });
  });

  it("throws when missing recipient", () => {
    expect(() => parseArgs([])).toThrow(/Recipient email/);
  });
});

describe("runDiagnostics", () => {
  const sampleOptions: ParsedArgs = { to: "user@example.com", limit: 2, json: false };

  it("returns domain status and filtered matches", async () => {
    const mockClient = {
      domains: {
        list: vi.fn().mockResolvedValue({
          data: {
            object: "list",
            has_more: false,
            data: [
              { id: "d1", name: "example.com", status: "verified", capability: "send", created_at: "", region: "us-east-1" },
            ],
          },
          error: null,
        }),
      },
      emails: {
        list: vi.fn().mockResolvedValue({
          data: {
            object: "list",
            has_more: false,
            data: [
              {
                id: "e1",
                subject: "Hello",
                created_at: "2025-01-01T00:00:00Z",
                last_event: "delivered",
                from: "Test <noreply@example.com>",
                to: ["user@example.com"],
                cc: [],
                bcc: [],
                reply_to: ["support@example.com"],
                scheduled_at: null,
              },
              {
                id: "e2",
                subject: "Ignored",
                created_at: "2025-01-01T00:00:00Z",
                last_event: "delivered",
                from: "Other <noreply@example.com>",
                to: ["other@example.com"],
                cc: [],
                bcc: [],
                reply_to: [],
                scheduled_at: null,
              },
            ],
          },
          error: null,
        }),
      },
    } satisfies Parameters<typeof runDiagnostics>[1];

    process.env.RESEND_FROM = "noreply@example.com";

    const diagnostics = await runDiagnostics(sampleOptions, mockClient);

    expect(diagnostics.domain.statusLine).toContain("example.com");
    expect(diagnostics.matches).toHaveLength(1);
    expect(diagnostics.totalMatches).toBe(1);
    expect(diagnostics.matches[0]).toMatchObject({ id: "e1", subject: "Hello" });
  });
});

describe("main", () => {
  it("prints usage when help flag provided", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await main(["--help"]);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith("Usage: pnpm email:check --to <email> [--limit N] [--json]");
    logSpy.mockRestore();
  });
});
