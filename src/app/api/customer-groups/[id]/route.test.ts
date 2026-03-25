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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerGroup: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { DELETE, PUT } from "./route";

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/customer-groups/group-1", {
    method,
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function params(id = "group-1") {
  return { params: Promise.resolve({ id }) };
}

describe("/api/customer-groups/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { businessId: "biz-1" },
    } as any);
    vi.mocked(prisma.customerGroup.findFirst).mockResolvedValue({
      id: "group-1",
      businessId: "biz-1",
    } as any);
  });

  it("PUT updates the group settings", async () => {
    vi.mocked(prisma.customerGroup.findFirst)
      .mockResolvedValueOnce({ id: "group-1", businessId: "biz-1" } as any)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.customerGroup.update).mockResolvedValue({
      id: "group-1",
      name: "VIP",
      promotionSmsEnabled: false,
    } as any);

    const res = await PUT(
      makeRequest("PUT", { name: "VIP", promotionSmsEnabled: false }),
      params()
    );

    expect(res.status).toBe(200);
    expect(prisma.customerGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "group-1" },
        data: {
          name: "VIP",
          promotionSmsEnabled: false,
        },
      })
    );
  });

  it("DELETE removes the group", async () => {
    const res = await DELETE(makeRequest("DELETE"), params());

    expect(res.status).toBe(200);
    expect(prisma.customerGroup.delete).toHaveBeenCalledWith({
      where: { id: "group-1" },
    });
  });
});
