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
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/customer-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("/api/customer-groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { businessId: "biz-1" },
    } as any);
  });

  it("GET returns business-owned groups", async () => {
    vi.mocked(prisma.customerGroup.findMany).mockResolvedValue([] as any);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(prisma.customerGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: "biz-1" },
      })
    );
  });

  it("POST creates a group with promotion SMS enabled by default", async () => {
    vi.mocked(prisma.customerGroup.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customerGroup.create).mockResolvedValue({
      id: "group-1",
      name: "VIP",
      promotionSmsEnabled: true,
    } as any);

    const res = await POST(makeRequest({ name: "  VIP  " }));

    expect(res.status).toBe(201);
    expect(prisma.customerGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          businessId: "biz-1",
          name: "VIP",
          promotionSmsEnabled: true,
        },
      })
    );
    expect(revalidateTag).toHaveBeenCalledWith("customer-groups-biz-1", "max");
  });

  it("POST rejects duplicate names case-insensitively", async () => {
    vi.mocked(prisma.customerGroup.findFirst).mockResolvedValue({ id: "group-1" } as any);

    const res = await POST(makeRequest({ name: "vip" }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
    expect(prisma.customerGroup.create).not.toHaveBeenCalled();
  });

  it("POST rejects names longer than the supported UI limit", async () => {
    const res = await POST(makeRequest({ name: "a".repeat(61) }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/60 characters or fewer/i);
    expect(prisma.customerGroup.findFirst).not.toHaveBeenCalled();
    expect(prisma.customerGroup.create).not.toHaveBeenCalled();
  });
});
