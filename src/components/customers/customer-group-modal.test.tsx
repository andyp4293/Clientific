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
    render(<CustomerGroupModal isOpen onClose={onClose} group={null} />);

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
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deletes an existing group after confirmation", async () => {
    const onClose = vi.fn();
    render(
      <CustomerGroupModal
        isOpen
        onClose={onClose}
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
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
