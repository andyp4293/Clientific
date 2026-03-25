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
  });

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
    render(<CustomerList customers={[baseCustomer]} groups={customerGroups} />);

    expect(screen.getByText("Customer groups")).toBeInTheDocument();
    expect(screen.getByText("VIP Regulars")).toBeInTheDocument();
    expect(screen.getByText("Promotion SMS on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /customer group/i })).toBeInTheDocument();
  });
});
