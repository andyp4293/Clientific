// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RegisterPage from "./page";

const mockSignIn = vi.fn();
const mockUseSession = vi.fn();
const mockAssign = vi.fn();
const mockReplace = vi.fn();
const searchParamValues = new Map<string, string | null>();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => searchParamValues.get(key) ?? null,
  }),
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamValues.clear();
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    mockSignIn.mockResolvedValue(undefined);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        assign: mockAssign,
        replace: mockReplace,
      },
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verificationEmailSent: true }),
      } as Response);
  });

  it("uses a minimal business step and moves the rest of setup into onboarding", async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/account email/i), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password \*/i), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    await screen.findByRole("heading", {
      name: /tell us about your business/i,
    });

    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business type/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/business phone/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/street address/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /business location/i }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: "Test Salon" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await screen.findByRole("heading", { name: /check your email/i });
    expect(
      screen.getByText(
        /finish your phone and location setup before the dashboard unlocks/i,
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    const registerCall = vi.mocked(global.fetch).mock.calls[1];
    expect(registerCall?.[0]).toBe("/api/auth/register");

    const payload = JSON.parse(
      (registerCall?.[1] as RequestInit).body as string,
    );
    expect(payload).toMatchObject({
      email: "owner@example.com",
      businessName: "Test Salon",
      businessType: "Salon",
    });
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("street");
    expect(payload).not.toHaveProperty("city");
    expect(payload).not.toHaveProperty("state");
    expect(payload).not.toHaveProperty("zipCode");
    expect(payload).not.toHaveProperty("country");
  }, 10000);

  it("hides the manual login link while auto-signing in after verification succeeds", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verificationEmailSent: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    mockSignIn.mockResolvedValue({ ok: true });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/account email/i), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password \*/i), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    await screen.findByRole("heading", {
      name: /tell us about your business/i,
    });

    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: "Test Salon" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await screen.findByRole("heading", { name: /check your email/i });

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "owner@example.com",
        password: "Password123!",
        redirect: false,
      });
    });

    expect(mockAssign).toHaveBeenCalledWith("/dashboard/onboarding");
    expect(
      screen.getByText(/redirecting to your dashboard/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /log in manually/i }),
    ).not.toBeInTheDocument();
  });

  it("redirects authenticated visitors to the dashboard with a full-page navigation", async () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          onboardingComplete: true,
        },
      },
    });

    render(<RegisterPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });

    expect(
      screen.getByText(/redirecting to your dashboard/i),
    ).toBeInTheDocument();
  });

  it("uses partner mode to create a free referral account without the business-type field", async () => {
    searchParamValues.set("partner", "1");

    render(<RegisterPage />);

    expect(
      screen.getByText(
        /create a free referral partner account, finish payout setup/i,
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/account email/i), {
      target: { value: "partner@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password \*/i), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    await screen.findByRole("heading", {
      name: /set up your partner profile/i,
    });

    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/business type/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/you do not need an active clientific subscription/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: "Jane Partner" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await screen.findByRole("heading", { name: /check your email/i });
    expect(
      screen.getByText(/finish stripe payout setup, then open referrals/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    const registerCall = vi.mocked(global.fetch).mock.calls[1];
    const payload = JSON.parse(
      (registerCall?.[1] as RequestInit).body as string,
    );
    expect(payload).toMatchObject({
      email: "partner@example.com",
      businessName: "Jane Partner",
      businessType: "Referral Partner",
    });
  });

  it("redirects partner signups to payout setup after verification succeeds", async () => {
    searchParamValues.set("partner", "1");

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verificationEmailSent: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);
    mockSignIn.mockResolvedValue({ ok: true });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/account email/i), {
      target: { value: "partner@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password \*/i), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    await screen.findByRole("heading", {
      name: /set up your partner profile/i,
    });

    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: "Jane Partner" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await screen.findByRole("heading", { name: /check your email/i });

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "partner@example.com",
        password: "Password123!",
        redirect: false,
      });
    });

    expect(mockAssign).toHaveBeenCalledWith("/dashboard/payouts");
  });
});
