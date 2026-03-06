import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { formatPhoneNumber } from "@/lib/utils";
import { calculateCustomerSegment } from "@/lib/segmentation";
import { requireActiveSubscription } from "@/lib/subscription";

// GET /api/customers/[id] - Get a single customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        businessId: session.user.businessId,
      },      include: {
        checkIns: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        appointments: {
          orderBy: { startTime: "desc" },
          take: 10,
          include: {
            service: true,
            staff: true,
          },
        },        redemptions: {
          orderBy: { createdAt: "desc" },
          include: {
            reward: true,
          },
        },
        pointsTransactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer });
  } catch (error: any) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id] - Update a customer
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

    // Check if customer exists and belongs to this business
    const existing = await prisma.customer.findFirst({
      where: {
        id,
        businessId: session.user.businessId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, email, phone, birthday, notes } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Format phone number if provided
    const formattedPhone = phone ? formatPhoneNumber(phone) : null;    // Check for duplicate email or phone (excluding current customer)
    if (email || formattedPhone) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          businessId: session.user.businessId,
          id: { not: id },
          OR: [
            email ? { email: email.toLowerCase() } : {},
            formattedPhone ? { phone: formattedPhone } : {},
          ].filter((obj) => Object.keys(obj).length > 0),
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Another customer with this email or phone already exists" },
          { status: 400 }
        );
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email ? email.toLowerCase() : null,
        phone: formattedPhone,
        birthday: birthday ? new Date(birthday) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ customer });
  } catch (error: any) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id] - Delete a customer
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

    // Check if customer exists and belongs to this business
    const existing = await prisma.customer.findFirst({
      where: {
        id,
        businessId: session.user.businessId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Delete customer (cascade will handle related records)
    await prisma.customer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
