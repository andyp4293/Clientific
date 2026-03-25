// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CustomerGroupModal from "./CustomerGroupModal";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe("CustomerGroupModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("creates a new group with the selected promotion SMS setting", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        group: { id: "group-new", name: "VIP", promotionSmsEnabled: false, _count: { memberships: 0 } },
      }),
    } as Response);

    render(<CustomerGroupModal isOpen onClose={onClose} onSaved={onSaved} group={null} />);

    fireEvent.change(screen.getByLabelText(/group name/i), {
      target: { value: "VIP" },
    });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: /create group/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/customer-groups");
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      name: "VIP",
      promotionSmsEnabled: false,
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: "group-new", name: "VIP", promotionSmsEnabled: false }),
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deletes an existing group after confirmation", async () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    render(
      <CustomerGroupModal
        isOpen
        onClose={onClose}
        onDeleted={onDeleted}
        group={{
          id: "group-1",
          name: "VIP",
          promotionSmsEnabled: true,
          _count: { memberships: 3 },
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /delete group/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/customer-groups/group-1");
    expect((options as RequestInit).method).toBe("DELETE");
    expect(onDeleted).toHaveBeenCalledWith("group-1");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the active segmented control pill inside the frame and highlights on in green", () => {
    render(<CustomerGroupModal isOpen onClose={vi.fn()} group={null} />);

    const toggle = screen.getByRole("switch");
    const slider = toggle.querySelector("span");

    expect(toggle.className).toContain("overflow-hidden");
    expect(toggle.className).toContain("min-w-[112px]");
    expect(slider?.className).toContain("translate-x-[calc(100%+0.25rem)]");
    expect(slider?.className).toContain("bg-primary");
    expect(screen.getByText("On").className).toContain("text-white");
  });

  it("uses an opaque mobile-safe-area top shell", () => {
    render(<CustomerGroupModal isOpen onClose={vi.fn()} group={null} />);

    const heading = screen.getByRole("heading", { name: "Create group" });
    const overlay = heading.closest('[data-mobile-overlay="true"]');
    const safeAreaFiller = document.querySelector('.h-\\[env\\(safe-area-inset-top\\)\\]');
    expect(overlay?.className).toContain("bg-gray-50");
    expect(overlay?.className).toContain("dark:bg-gray-900");
    expect(safeAreaFiller?.className).toContain("bg-gray-50");
    expect(safeAreaFiller?.className).toContain("dark:bg-gray-900");
  });

  it("uses the shorter deals SMS wording in group settings", () => {
    render(<CustomerGroupModal isOpen onClose={vi.fn()} group={null} />);

    expect(screen.getByText("Deals SMS messages")).toBeInTheDocument();
    expect(screen.getByText("Include this group in deals SMS messages.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /toggle deals sms messages/i })).toBeInTheDocument();
  });

  it("renders the richer mobile header for customer groups", () => {
    render(<CustomerGroupModal isOpen onClose={vi.fn()} group={null} />);

    expect(screen.getByText("Customer group")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create group" })).toBeInTheDocument();
    expect(
      screen.getByText(/choose a name and decide whether this group should receive deals sms messages/i),
    ).toBeInTheDocument();
  });
});
