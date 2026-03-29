// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CustomerList from "./CustomerList";

const { mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams(),
}));

vi.mock("./AddCustomerModal", () => ({
  default: () => null,
}));

vi.mock("./EditCustomerModal", () => ({
  default: () => null,
}));

vi.mock("./CustomerGroupModal", () => ({
  default: () => null,
}));

vi.mock("./SendCustomerMessageModal", () => ({
  default: () => null,
}));

const baseCustomer = {
  id: "cust-1",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "+15551234567",
  smsConsent: true,
  smsOptedOut: false,
  segment: "VIP",
  totalSpent: 250,
  lastVisit: new Date("2026-03-12T12:00:00.000Z"),
  birthday: null,
  notes: null,
  createdAt: new Date("2026-03-01T12:00:00.000Z"),
  _count: {
    checkIns: 3,
    appointments: 4,
  },
  groupMemberships: [],
} as const;

const customerGroups = [
  {
    id: "group-vip",
    name: "VIP Regulars",
    promotionSmsEnabled: true,
    _count: { memberships: 2 },
  },
];

describe("CustomerList filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("renders broader filter controls and active filter chips", () => {
    render(
      <CustomerList
        customers={[baseCustomer]}
        groups={customerGroups}
        initialSearch="jane"
        initialGroupFilter="group-vip"
        initialSmsFilter="enabled"
        initialContactFilter="both"
        initialVisitFilter="visited"
      />,
    );

    expect(screen.getByText("Filter customers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
    expect(screen.getByText("Search: jane")).toBeInTheDocument();
    expect(screen.getByText("Group: VIP Regulars")).toBeInTheDocument();
    expect(screen.getByText("SMS: SMS enabled")).toBeInTheDocument();
    expect(screen.getByText("Contact: Has both")).toBeInTheDocument();
    expect(screen.getByText("Visits: Visited before")).toBeInTheDocument();
  }, 10000);

  it("updates the SMS filter while preserving the other query params", () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams("search=jane&segment=VIP&group=group-vip&contact=both&visit=visited"),
    );

    render(
      <CustomerList
        customers={[baseCustomer]}
        groups={customerGroups}
        initialSearch="jane"
        initialGroupFilter="group-vip"
        initialContactFilter="both"
        initialVisitFilter="visited"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /sms status/i }));
    fireEvent.click(screen.getByRole("option", { name: /sms enabled/i }));

    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/customers?search=jane&group=group-vip&contact=both&visit=visited&sms=enabled",
    );
  });

  it("clears every filter with one action", () => {
    render(
      <CustomerList
        customers={[baseCustomer]}
        groups={customerGroups}
        initialSearch="jane"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /clear all filters/i }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard/customers");
  });

  it("shows customer group filter controls and group cards", () => {
    render(
      <CustomerList
        customers={[baseCustomer]}
        groups={customerGroups}
        initialTab="groups"
      />,
    );

    expect(screen.getByText("Customer groups")).toBeInTheDocument();
    expect(screen.getByText("VIP Regulars")).toBeInTheDocument();
    expect(screen.getByText("Promotion SMS on")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /groups/i })).toHaveAttribute("aria-selected", "true");
  });

  it("renders the add group action as a full-width mobile button with the new label", () => {
    render(<CustomerList customers={[baseCustomer]} groups={[]} initialTab="groups" />);

    const addGroupButton = screen.getByRole("button", { name: /new group/i });
    expect(addGroupButton.className).toContain("w-full");
    expect(addGroupButton.className).toContain("rounded-2xl");
    expect(screen.getByText("New group")).toBeInTheDocument();
  });

  it("renders tab buttons and paginates the customer table with numbered buttons", () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("search=jane"));

    render(
      <CustomerList
        customers={[baseCustomer]}
        groups={customerGroups}
        currentPage={2}
        pageSize={25}
        totalCustomers={68}
        totalPages={3}
      />,
    );

    expect(screen.getByRole("tab", { name: /customers/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /groups/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Showing 26-26 of 68 customers")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "3" }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard/customers?search=jane&page=3");
  });
});
