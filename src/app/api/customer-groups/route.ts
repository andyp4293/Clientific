import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/subscription";
import {
  CUSTOMER_GROUP_NAME_MAX_LENGTH,
  normalizeCustomerGroupName,
} from "@/lib/customer-groups";
import {
  getCustomerGroupsCacheTag,
  SHARED_REFERENCE_DATA_REVALIDATE_SECONDS,
} from "@/lib/cache-tags";
import { revalidateTag, unstable_cache } from "next/cache";

function getCachedCustomerGroups(businessId: string) {
  return unstable_cache(
    () =>
      prisma.customerGroup.findMany({
        where: { businessId },
        include: {
          _count: {
            select: {
              memberships: true,
            },
          },
        },
        orderBy: [{ name: "asc" }],
      }),
    [getCustomerGroupsCacheTag(businessId)],
    {
      tags: [getCustomerGroupsCacheTag(businessId)],
      revalidate: SHARED_REFERENCE_DATA_REVALIDATE_SECONDS,
    },
  )();
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await getCachedCustomerGroups(session.user.businessId);

    return NextResponse.json({ groups });
  } catch (error) {
    console.error("GET /api/customer-groups error:", error);
    return NextResponse.json({ error: "Failed to fetch customer groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    const name = normalizeCustomerGroupName(body?.name);
    const promotionSmsEnabled = body?.promotionSmsEnabled !== false;

    if (!name) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    if (name.length > CUSTOMER_GROUP_NAME_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Group name must be ${CUSTOMER_GROUP_NAME_MAX_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    const duplicate = await prisma.customerGroup.findFirst({
      where: {
        businessId: session.user.businessId,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "A customer group with that name already exists" },
        { status: 409 }
      );
    }

    const group = await prisma.customerGroup.create({
      data: {
        businessId: session.user.businessId,
        name,
        promotionSmsEnabled,
      },
      include: {
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    });

    revalidateTag(getCustomerGroupsCacheTag(session.user.businessId), "max");

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error("POST /api/customer-groups error:", error);
    return NextResponse.json({ error: "Failed to create customer group" }, { status: 500 });
  }
}
