import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { formatPhoneNumber } from "@/lib/utils";
import { requireActiveSubscription, checkPlanLimit } from "@/lib/subscription";
import { revalidateTag } from "next/cache";

// GET /api/customers - List all customers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const segment = searchParams.get("segment");

    const where: any = { businessId: session.user.businessId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (segment) {
      where.segment = segment;
    }    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: {
            checkIns: true,
            appointments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ customers });
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

// POST /api/customers - Create a new customer
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const limitCheck = await checkPlanLimit(session.user.businessId, 'customers');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: `Customer limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan.`, code: 'PLAN_LIMIT_REACHED' },
        { status: 403 }
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
    const formattedPhone = phone ? formatPhoneNumber(phone) : null;

    // Check for duplicate email or phone
    if (email || formattedPhone) {
      const existing = await prisma.customer.findFirst({
        where: {
          businessId: session.user.businessId,
          OR: [
            email ? { email: email.toLowerCase() } : {},
            formattedPhone ? { phone: formattedPhone } : {},
          ].filter((obj) => Object.keys(obj).length > 0),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Customer with this email or phone already exists" },
          { status: 400 }
        );
      }
    }

    const customer = await prisma.customer.create({
      data: {
        businessId: session.user.businessId,
        name: name.trim(),
        email: email ? email.toLowerCase() : null,
        phone: formattedPhone,
        birthday: birthday ? new Date(birthday) : null,
        notes: notes || null,
        segment: "NEW", // Default segment
        points: 0,
        totalSpent: 0,
      },
    });

    revalidateTag(`dashboard-stats-${session.user.businessId}`, {});
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
