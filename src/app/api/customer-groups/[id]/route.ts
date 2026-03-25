import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/subscription";
import {
  CUSTOMER_GROUP_NAME_MAX_LENGTH,
  normalizeCustomerGroupName,
} from "@/lib/customer-groups";

async function getOwnedGroup(id: string, businessId: string) {
  return prisma.customerGroup.findFirst({
    where: {
      id,
      businessId,
    },
    select: {
      id: true,
      businessId: true,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;
    const existing = await getOwnedGroup(id, session.user.businessId);

    if (!existing) {
      return NextResponse.json({ error: "Customer group not found" }, { status: 404 });
    }

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
        id: { not: id },
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

    const group = await prisma.customerGroup.update({
      where: { id },
      data: {
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

    return NextResponse.json({ group });
  } catch (error) {
    console.error("PUT /api/customer-groups/[id] error:", error);
    return NextResponse.json({ error: "Failed to update customer group" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;
    const existing = await getOwnedGroup(id, session.user.businessId);

    if (!existing) {
      return NextResponse.json({ error: "Customer group not found" }, { status: 404 });
    }

    await prisma.customerGroup.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customer-groups/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete customer group" }, { status: 500 });
  }
}
