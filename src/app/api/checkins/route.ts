import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import {
  buildCustomerPhoneData,
  buildCustomerPhoneMatchClauses,
  normalizeOptionalPhoneNumber,
} from '@/lib/phone';
import { updateCustomerSegment } from '@/lib/segment';
import { businessDayStart } from '@/lib/timezone';
import { requireActiveSubscription } from '@/lib/subscription';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: { timezone: true },
    });
    const timezone = business?.timezone ?? 'America/New_York';

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    const where: any = { businessId: session.user.businessId };

    if (date) {
      const startOfDay = businessDayStart(date, timezone);
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
      where.checkInTime = { gte: startOfDay, lte: endOfDay };
    }

    const checkIns = await prisma.checkIn.findMany({
      where,
      include: {
        customer: true,
        service: true,
        staff: true,
      },
      orderBy: { checkInTime: 'desc' },
    });

    return NextResponse.json({ checkIns, timezone });
  } catch (error) {
    console.error('GET /api/checkins error:', error);
    return NextResponse.json({ error: 'Failed to fetch check-ins' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const body = await req.json();
    const {
      customerId,
      serviceId,
      staffId,
      amountSpent,
      phone,
      customerName,
      customerEmail,
    } = body;

    const providedPhoneData = buildCustomerPhoneData(phone);

    let resolvedCustomerId = typeof customerId === 'string' && customerId.trim().length > 0
      ? customerId.trim()
      : null;

    if (!resolvedCustomerId) {
      const normalizedPhone = normalizeOptionalPhoneNumber(phone);
      const phoneData = buildCustomerPhoneData(phone);

      if (!normalizedPhone || !phoneData.phoneLookupKey) {
        return NextResponse.json({ error: 'Customer phone number required' }, { status: 400 });
      }

      const matchingCustomers = await prisma.customer.findMany({
        where: {
          businessId: session.user.businessId,
          OR: buildCustomerPhoneMatchClauses(phone),
        },
        orderBy: [{ lastVisit: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneLookupKey: true,
        },
      });

      if (matchingCustomers.length > 1) {
        return NextResponse.json(
          {
            error: 'Multiple customers already use this number',
            code: 'MULTIPLE_CUSTOMERS_MATCH_PHONE',
            customers: matchingCustomers,
          },
          { status: 409 }
        );
      }

      if (matchingCustomers.length === 1) {
        const match = matchingCustomers[0];
        resolvedCustomerId = match.id;

        if (match.phone !== phoneData.phone || match.phoneLookupKey !== phoneData.phoneLookupKey) {
          await prisma.customer.update({
            where: { id: match.id },
            data: {
              phone: phoneData.phone,
              phoneLookupKey: phoneData.phoneLookupKey,
            },
          });
        }
      } else {
        if (typeof customerName !== 'string' || customerName.trim().length === 0) {
          return NextResponse.json(
            {
              error: 'Customer details required for a new phone number',
              code: 'CUSTOMER_DETAILS_REQUIRED',
            },
            { status: 400 }
          );
        }

        const createdCustomer = await prisma.customer.create({
          data: {
            businessId: session.user.businessId,
            name: customerName.trim(),
            email:
              typeof customerEmail === 'string' && customerEmail.trim().length > 0
                ? customerEmail.trim().toLowerCase()
                : null,
            phone: phoneData.phone,
            phoneLookupKey: phoneData.phoneLookupKey,
            segment: 'NEW',
            totalSpent: 0,
          },
          select: { id: true },
        });

        resolvedCustomerId = createdCustomer.id;
      }
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: resolvedCustomerId,
        businessId: session.user.businessId,
      },
      select: { id: true, phone: true, phoneLookupKey: true },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (
      providedPhoneData.phone &&
      (customer.phone !== providedPhoneData.phone ||
        customer.phoneLookupKey !== providedPhoneData.phoneLookupKey)
    ) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          phone: providedPhoneData.phone,
          phoneLookupKey: providedPhoneData.phoneLookupKey,
        },
      });
    }

    // Create check-in
    const checkIn = await prisma.checkIn.create({
      data: {
        businessId: session.user.businessId,
        customerId: customer.id,
        serviceId: serviceId || undefined,
        staffId: staffId || undefined,
        amountSpent: amountSpent || undefined,
        checkInTime: new Date(),
      },
      include: {
        customer: true,
        service: true,
        staff: true,
      },
    });

    // Keep customer visit and spend history in sync with the new check-in.
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        lastVisit: new Date(),
        totalSpent: amountSpent ? { increment: amountSpent } : undefined,
      },
    });

    // Update customer segment based on new visit/spend data
    updateCustomerSegment(customer.id).catch(console.error);

    return NextResponse.json({ checkIn });
  } catch (error) {
    console.error('POST /api/checkins error:', error);
    return NextResponse.json({ error: 'Failed to create check-in' }, { status: 500 });
  }
}
