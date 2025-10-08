import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignInForm } from "../SignInForm";

const trackMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn());
const signInWithOtpMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...(args as Parameters<typeof trackMock>)),
}));

vi.mock("@/lib/analytics/emit", () => ({
  emit: (...args: unknown[]) => emitMock(...(args as Parameters<typeof emitMock>)),
}));

vi.mock("@/lib/env-client", () => ({
  clientEnv: {
    app: {
      siteUrl: "http://localhost:3000",
    },
  },
}));

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtpMock(...args),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("<SignInForm /> magic link flow", () => {
  afterEach(() => {
    trackMock.mockReset();
    emitMock.mockReset();
    signInWithOtpMock.mockReset();
  });

  it("sends a magic link and shows success status", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });

    render(<SignInForm redirectedFrom="/dashboard" />);

    await userEvent.type(screen.getByLabelText(/email address/i), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining("/api/auth/callback?redirectedFrom=%2Fdashboard"),
        }),
      });
    });

    expect(
      await screen.findByText(/magic link sent! check your inbox to finish signing in/i),
    ).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith("auth_magiclink_sent", expect.any(Object));
    expect(emitMock).toHaveBeenCalledWith("auth_magiclink_sent", expect.any(Object));
  });

  it("shows error status when Supabase returns an error", async () => {
    signInWithOtpMock.mockResolvedValue({
      error: { message: "Invalid email domain", name: "AuthApiError", status: 400 },
    });

    render(<SignInForm redirectedFrom="/dashboard" />);

    await userEvent.type(screen.getByLabelText(/email address/i), "invalid@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    expect(await screen.findByText(/invalid email domain/i)).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith(
      "auth_signin_error",
      expect.objectContaining({ method: "magic_link" }),
    );
  });

  it("disables repeated submissions during cooldown", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });

    render(<SignInForm redirectedFrom="/dashboard" />);

    const button = screen.getByRole("button", { name: /send magic link/i });
    await userEvent.type(screen.getByLabelText(/email address/i), "ada@example.com");
    await userEvent.click(button);

    await screen.findByText(/magic link sent! check your inbox to finish signing in/i);
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.textContent).toMatch(/resend in/i);
  });
});
