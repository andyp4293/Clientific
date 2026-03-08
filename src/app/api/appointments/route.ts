import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { sendAppointmentConfirmation } from '@/lib/twilio';
import { sendNewBookingEmail } from '@/lib/email';
import { businessDayStart } from '@/lib/timezone';
import { requireActiveSubscription } from '@/lib/subscription';
import { revalidateTag } from 'next/cache';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';

const businessMidnightUTC = businessDayStart;

// GET - List appointments
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    const where: any = { businessId: business.id };

    if (startDate && endDate) {
      const start = businessMidnightUTC(startDate, business.timezone);
      const end = businessMidnightUTC(endDate, business.timezone);
      where.startTime = { gte: start, lt: end };
    } else if (date) {
      const startOfDay = businessMidnightUTC(date, business.timezone);
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const staffIdParam = searchParams.get('staffId');
    if (staffIdParam) {
      where.staffId = staffIdParam;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        customer: true,
        service: true,
        staff: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return NextResponse.json({ appointments, timezone: business.timezone });
  } catch (error: any) {
    console.error('Fetch appointments error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

// POST - Create appointment
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, timezone: true, notifyNewBookingEmail: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const {
      customerId,
      serviceId,
      staffId,
      startTime,
      duration,
      notes,
    } = await req.json();

    if (!customerId || !startTime || !duration) {
      return NextResponse.json(
        { error: 'Customer, start time, and duration are required' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);

    // Check for conflicts — only when a specific staff member is assigned
    if (staffId) {
      const conflicts = await prisma.appointment.findMany({
        where: {
          businessId: business.id,
          staffId,
          status: {
            in: ['scheduled', 'confirmed'],
          },
          OR: [
            {
              AND: [
                { startTime: { lte: start } },
                { endTime: { gt: start } },
              ],
            },
            {
              AND: [
                { startTime: { lt: end } },
                { endTime: { gte: end } },
              ],
            },
            {
              AND: [
                { startTime: { gte: start } },
                { endTime: { lte: end } },
              ],
            },
          ],
        },
      });

      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: 'Time slot is not available' },
          { status: 409 }
        );
      }
    }    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerId,
        serviceId: serviceId || null,
        staffId: staffId || null,
        startTime: start,
        endTime: end,
        duration,
        notes: notes || null,
        status: 'scheduled',
        source: 'dashboard',
      },
      include: {
        customer: true,
        service: true,
        staff: true,
        business: {
          select: {
            name: true,
          },
        },
      },
    });    // Send SMS confirmation
    let smsResult = null;
    if (appointment.customer.phone) {
      smsResult = await sendAppointmentConfirmation(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name || 'Appointment',
        staffName: appointment.staff?.fullName || 'our team',
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        duration: appointment.duration,
        timezone: business.timezone,
      });

      if (smsResult.success) {
        console.log('✅ SMS confirmation sent to:', appointment.customer.phone);
      }
    }

    // Create notification
    await prisma.notification.create({
      data: {
        businessId: business.id,
        type: 'new_appointment',
        title: 'New Appointment',
        message: `New appointment scheduled with ${appointment.customer.name} for ${new Date(appointment.startTime).toLocaleString()}`,
        link: `/dashboard/appointments`,
      },
    });

    // Send email to business owner (non-blocking)
    if (business.notifyNewBookingEmail !== false) {
      const appBase = getConfiguredAppBaseUrl();
      sendNewBookingEmail(business.email, {
        businessName: business.name,
        customerName: appointment.customer.name,
        customerPhone: appointment.customer.phone,
        serviceName: appointment.service?.name || 'Appointment',
        staffName: appointment.staff?.fullName || null,
        dateTime: appointment.startTime,
        duration: appointment.duration,
        notes: appointment.notes,
        appointmentUrl: `${appBase}/dashboard/appointments`,
        timezone: business.timezone,
      }).catch(() => {});
    }

    revalidateTag(`dashboard-stats-${business.id}`, {});
    return NextResponse.json({
      appointment,
      smsNotification: smsResult?.success
        ? 'Confirmation SMS sent'
        : appointment.customer.phone
          ? 'SMS notification failed'
          : 'No phone number provided',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create appointment error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create appointment' },
      { status: 500 }
    );
  }
}
