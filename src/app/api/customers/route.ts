import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { formatPhoneNumber } from "@/lib/utils";
import { buildCustomerPhoneData, buildCustomerPhoneMatchClauses } from "@/lib/phone";
import { requireActiveSubscription, checkPlanLimit } from "@/lib/subscription";
import { revalidateTag } from "next/cache";
import { blockedContentError, getBlockedFieldLabel } from "@/lib/moderation";
import { buildCustomerWhereClause } from "@/lib/customer-filters";
import { normalizeCustomerGroupIds } from "@/lib/customer-groups";

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
    const group = searchParams.get("group");
    const sms = searchParams.get("sms");
    const contact = searchParams.get("contact");
    const visit = searchParams.get("visit");
    const limitParam = searchParams.get("limit");
    const requestedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
    const take =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 50)
        : undefined;

    const where = buildCustomerWhereClause({
      businessId: session.user.businessId,
      search: search ?? undefined,
      segment: segment ?? undefined,
      group: group ?? undefined,
      sms: sms ?? undefined,
      contact: contact ?? undefined,
      visit: visit ?? undefined,
    });

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: {
            checkIns: true,
            appointments: true,
          },
        },
        groupMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                promotionSmsEnabled: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
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
    const dealSmsBlocked = body?.dealSmsBlocked === true;
    const groupIds = normalizeCustomerGroupIds(body?.groupIds);

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Customer name', value: name },
      { label: 'Notes', value: notes },
    ]);
    if (blockedField) {
      return NextResponse.json(
        { error: blockedContentError(blockedField) },
        { status: 400 }
      );
    }

    // Format phone number if provided
    const formattedPhone = phone ? formatPhoneNumber(phone) : null;
    const phoneData = buildCustomerPhoneData(phone);

    // Check for duplicate email or phone
    if (email || formattedPhone) {
      const existing = await prisma.customer.findFirst({
        where: {
          businessId: session.user.businessId,
          OR: [
            email ? { email: email.toLowerCase() } : {},
            ...(formattedPhone ? buildCustomerPhoneMatchClauses(formattedPhone) : []),
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

    if (groupIds.length > 0) {
      const validGroups = await prisma.customerGroup.findMany({
        where: {
          businessId: session.user.businessId,
          id: { in: groupIds },
        },
        select: { id: true },
      });

      if (validGroups.length !== groupIds.length) {
        return NextResponse.json(
          { error: "One or more selected customer groups are invalid" },
          { status: 400 }
        );
      }
    }

    const customer = await prisma.customer.create({
      data: {
        businessId: session.user.businessId,
        name: name.trim(),
        email: email ? email.toLowerCase() : null,
        phone: phoneData.phone,
        phoneLookupKey: phoneData.phoneLookupKey,
        birthday: birthday ? new Date(birthday) : null,
        notes: notes || null,
        dealSmsBlocked,
        segment: "NEW", // Default segment
        totalSpent: 0,
        ...(groupIds.length > 0
          ? {
              groupMemberships: {
                create: groupIds.map((groupId) => ({ groupId })),
              },
            }
          : {}),
      },
      include: {
        groupMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                promotionSmsEnabled: true,
              },
            },
          },
        },
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
