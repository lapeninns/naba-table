import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignInForm } from "../SignInForm";

const trackMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn());
const signInWithOtpMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

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
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => replaceMock(...args),
    refresh: (...args: unknown[]) => refreshMock(...args),
  }),
}));

describe("<SignInForm /> magic link flow", () => {
  afterEach(() => {
    trackMock.mockReset();
    emitMock.mockReset();
    signInWithOtpMock.mockReset();
    signInWithPasswordMock.mockReset();
    replaceMock.mockReset();
    refreshMock.mockReset();
  });

  it("sends a magic link and shows success status", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });

    render(<SignInForm redirectedFrom="/my-bookings" />);

    await userEvent.type(screen.getByLabelText(/email address/i), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining("/api/auth/callback?redirectedFrom=%2Fmy-bookings"),
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

    render(<SignInForm redirectedFrom="/my-bookings" />);

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

    render(<SignInForm redirectedFrom="/my-bookings" />);

    const button = screen.getByRole("button", { name: /send magic link/i });
    await userEvent.type(screen.getByLabelText(/email address/i), "ada@example.com");
    await userEvent.click(button);

    await screen.findByText(/magic link sent! check your inbox to finish signing in/i);
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.textContent).toMatch(/resend in/i);
  });
});

describe("<SignInForm /> password flow", () => {
  afterEach(() => {
    trackMock.mockReset();
    emitMock.mockReset();
    signInWithOtpMock.mockReset();
    signInWithPasswordMock.mockReset();
    replaceMock.mockReset();
    refreshMock.mockReset();
  });

  it("signs in with password and redirects on success", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });

    render(<SignInForm redirectedFrom="/my-bookings" />);

    await userEvent.click(screen.getByRole("tab", { name: /password/i }));
    await userEvent.type(screen.getByLabelText(/email address/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "super-secret");
    const submitButton = screen.getByRole("button", { name: /sign in with password/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "super-secret",
      });
    });

    expect(
      await screen.findByText(/signed in successfully\. redirecting/i),
    ).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith(
      "auth_signin_success",
      expect.objectContaining({ method: "password" }),
    );
    expect(emitMock).toHaveBeenCalledWith(
      "auth_signin_success",
      expect.objectContaining({ method: "password" }),
    );
    expect(replaceMock).toHaveBeenCalledWith("/my-bookings");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows error status when Supabase password auth fails", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials", name: "AuthApiError", status: 400 },
    });

    render(<SignInForm redirectedFrom="/my-bookings" />);

    await userEvent.click(screen.getByRole("tab", { name: /password/i }));
    await userEvent.type(screen.getByLabelText(/email address/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in with password/i }));

    expect(await screen.findByText(/invalid login credentials/i)).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith(
      "auth_signin_error",
      expect.objectContaining({ method: "password" }),
    );
    expect(emitMock).toHaveBeenCalledWith(
      "auth_signin_error",
      expect.objectContaining({ method: "password" }),
    );
  });
});
