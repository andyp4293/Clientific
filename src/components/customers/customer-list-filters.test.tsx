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
  points: 120,
  totalSpent: 250,
  lastVisit: new Date("2026-03-12T12:00:00.000Z"),
  birthday: null,
  notes: null,
  createdAt: new Date("2026-03-01T12:00:00.000Z"),
  _count: {
    checkIns: 3,
    appointments: 4,
  },
} as const;

describe("CustomerList filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("renders broader filter controls and active filter chips", () => {
    render(
      <CustomerList
        customers={[baseCustomer]}
        segmentCounts={[{ segment: "VIP", _count: 1 }]}
        initialSearch="jane"
        initialSegment="VIP"
        initialSmsFilter="enabled"
        initialContactFilter="both"
        initialVisitFilter="visited"
      />,
    );

    expect(screen.getByText("Filter customers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
    expect(screen.getByText("Search: jane")).toBeInTheDocument();
    expect(screen.getByText("Type: VIP")).toBeInTheDocument();
    expect(screen.getByText("SMS: SMS enabled")).toBeInTheDocument();
    expect(screen.getByText("Contact: Has both")).toBeInTheDocument();
    expect(screen.getByText("Visits: Visited before")).toBeInTheDocument();
  });

  it("updates the SMS filter while preserving the other query params", () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams("search=jane&segment=VIP&contact=both&visit=visited"),
    );

    render(
      <CustomerList
        customers={[baseCustomer]}
        segmentCounts={[{ segment: "VIP", _count: 1 }]}
        initialSearch="jane"
        initialSegment="VIP"
        initialContactFilter="both"
        initialVisitFilter="visited"
      />,
    );

    fireEvent.change(screen.getByLabelText(/sms status/i), {
      target: { value: "enabled" },
    });

    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/customers?search=jane&segment=VIP&contact=both&visit=visited&sms=enabled",
    );
  });

  it("clears every filter with one action", () => {
    render(
      <CustomerList
        customers={[baseCustomer]}
        segmentCounts={[{ segment: "VIP", _count: 1 }]}
        initialSearch="jane"
        initialSegment="VIP"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /clear all filters/i }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard/customers");
  });
});
