import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}));

vi.mock("@/lib/subscription", () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/utils", () => ({
  formatPhoneNumber: (phone: string) => phone,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerGroup: {
      findMany: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { DELETE, GET, PUT } from "./route";

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/customers/cust-1", {
    method,
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function params(id = "cust-1") {
  return { params: Promise.resolve({ id }) };
}

describe("/api/customers/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { businessId: "biz-1", email: "test@test.com" },
    } as any);
  });

  it("GET includes group memberships for the customer", async () => {
    vi.mocked(prisma.customer.findFirst).mockResolvedValue({
      id: "cust-1",
      businessId: "biz-1",
    } as any);

    const res = await GET(makeRequest("GET"), params());

    expect(res.status).toBe(200);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          groupMemberships: expect.any(Object),
        }),
      })
    );
  });

  it("PUT syncs customer group memberships", async () => {
    vi.mocked(prisma.customer.findFirst)
      .mockResolvedValueOnce({
        id: "cust-1",
        businessId: "biz-1",
      } as any)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.customerGroup.findMany).mockResolvedValue([
      { id: "group-1" },
      { id: "group-2" },
    ] as any);
    vi.mocked(prisma.customer.update).mockResolvedValue({
      id: "cust-1",
      businessId: "biz-1",
    } as any);

    const res = await PUT(
      makeRequest("PUT", {
        name: "Jane Doe",
        email: "",
        phone: "",
        birthday: "",
        notes: "",
        groupIds: ["group-1", "group-2"],
      }),
      params()
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupMemberships: {
            deleteMany: {},
            create: [{ groupId: "group-1" }, { groupId: "group-2" }],
          },
        }),
      })
    );
  });

  it("PUT rejects invalid customer groups", async () => {
    vi.mocked(prisma.customer.findFirst).mockResolvedValue({
      id: "cust-1",
      businessId: "biz-1",
    } as any);
    vi.mocked(prisma.customerGroup.findMany).mockResolvedValue([{ id: "group-1" }] as any);

    const res = await PUT(
      makeRequest("PUT", {
        name: "Jane Doe",
        groupIds: ["group-1", "group-2"],
      }),
      params()
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/selected customer groups are invalid/i);
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it("DELETE returns 404 when the customer does not belong to the business", async () => {
    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);

    const res = await DELETE(makeRequest("DELETE"), params());

    expect(res.status).toBe(404);
    expect(prisma.customer.delete).not.toHaveBeenCalled();
  });
});
