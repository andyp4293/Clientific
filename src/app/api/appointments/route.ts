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
import { validateBusinessHoursForAppointment } from '@/lib/business-hours-validation';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { validateBookableStaffSelection } from '@/lib/staff-service-validation';
import {
  collectAppointmentServiceIds,
  withAppointmentServiceDisplay,
} from '@/lib/appointment-services';
import { scheduleAppointmentReminder } from '@/lib/appointment-reminders';
import { ensureAppointmentShortId } from '@/lib/appointment-short-id';
import { createBusinessNotification } from '@/lib/mobile-push';
import { buildAppointmentScheduledNotificationMessage } from '@/lib/appointment-notification-copy';

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

    const serviceIds = collectAppointmentServiceIds(appointments);
    const services = serviceIds.length > 0
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true },
        })
      : [];
    const appointmentsWithServices = withAppointmentServiceDisplay(appointments, services);

    return NextResponse.json({ appointments: appointmentsWithServices, timezone: business.timezone });
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
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        notifyNewBookingEmail: true,
        vapiPhoneNumber: true,
        businessHours: { select: { hours: true } },
        closureDates: {
          select: {
            date: true,
            label: true,
          },
        },
      },
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
      appointmentSmsConsent,
    } = await req.json();

    if (!customerId || !startTime || !duration) {
      return NextResponse.json(
        { error: 'Customer, start time, and duration are required' },
        { status: 400 }
      );
    }

    const blockedField = getBlockedFieldLabel([{ label: 'Notes', value: notes }]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);
    const businessHoursError = validateBusinessHoursForAppointment({
      startTime: start,
      endTime: end,
      timezone: business.timezone,
      businessHours: business.businessHours?.hours,
      closureDates: business.closureDates,
    });

    if (businessHoursError) {
      return NextResponse.json(
        { error: businessHoursError.error },
        { status: businessHoursError.status }
      );
    }

    if (staffId) {
      const staffError = await validateBookableStaffSelection({
        staffId,
        businessId: business.id,
        serviceIds: serviceId ? [serviceId] : [],
        businessHours: business.businessHours?.hours,
        timezone: business.timezone,
        startTime: start,
        endTime: end,
      });

      if (staffError) {
        return NextResponse.json({ error: staffError.error }, { status: staffError.status });
      }
    }

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
    }

    if (appointmentSmsConsent === true) {
      const manualConsentCustomer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          businessId: business.id,
        },
        select: {
          id: true,
          phone: true,
        },
      });

      if (!manualConsentCustomer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      if (!manualConsentCustomer.phone) {
        return NextResponse.json(
          { error: 'Customer needs a phone number before appointment texts can be enabled' },
          { status: 400 }
        );
      }
    }

    const appointment = await prisma.appointment.create({
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
    });

    let manualConsentApplied = false;
    if (appointmentSmsConsent === true && appointment.customer.phone) {
      await prisma.customer.update({
        where: { id: appointment.customer.id },
        data: {
          smsConsent: true,
          smsOptedOut: false,
          smsOptedOutAt: null,
        },
      });

      await prisma.smsConsentEvent.create({
        data: {
          businessId: business.id,
          customerId: appointment.customer.id,
          phone: appointment.customer.phone,
          eventType: 'MANUAL_APPOINTMENT_OPT_IN',
          source: 'dashboard_appointment',
          metadata: {
            consentType: 'transactional',
            consentMethod: 'verbal',
            channel: 'dashboard-appointments',
            appointmentId: appointment.id,
            appointmentStartTime: appointment.startTime.toISOString(),
          },
        },
      });

      manualConsentApplied = true;
    }

    const canSendTransactionalSms =
      Boolean(appointment.customer.phone) &&
      (appointment.customer.smsConsent || manualConsentApplied) &&
      !(appointment.customer.smsOptedOut && !manualConsentApplied);

    // Send SMS confirmation
    let smsResult = null;
    let reminderResult = null;
    if (canSendTransactionalSms && appointment.customer.phone) {
      const appBase = getConfiguredAppBaseUrl();
      const shortId = await ensureAppointmentShortId(appointment.id, appointment.shortId);
      const appointmentUrl = shortId ? `${appBase}/a/${shortId}` : undefined;

      smsResult = await sendAppointmentConfirmation(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name || 'Appointment',
        staffName: appointment.staff?.fullName || 'our team',
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        duration: appointment.duration,
        appointmentUrl,
        timezone: business.timezone,
        senderPhone: business.vapiPhoneNumber,
      });

      if (smsResult.success) {
        console.log('✅ SMS confirmation sent to:', appointment.customer.phone);
      }

      reminderResult = await scheduleAppointmentReminder(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name || 'Appointment',
        staffName: appointment.staff?.fullName || 'our team',
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        appointmentUrl,
        timezone: business.timezone,
        senderPhone: business.vapiPhoneNumber,
      });

      if (reminderResult.success) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { reminderSent: true },
        });
      }
    }

    // Create notification
    await createBusinessNotification({
      businessId: business.id,
      type: 'new_appointment',
      title: 'New Appointment',
      message: buildAppointmentScheduledNotificationMessage({
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name ?? 'Appointment',
        staffName: appointment.staff?.fullName ?? null,
        startTime: appointment.startTime,
        timezone: business.timezone,
      }),
      link: '/dashboard/appointments',
      sendPush: business.notifyNewBookingEmail !== false,
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
          ? canSendTransactionalSms
            ? 'SMS notification failed'
            : 'Customer has not opted into SMS'
          : 'No phone number provided',
      reminderNotification: reminderResult?.success
        ? '2-hour reminder scheduled'
        : appointment.customer.phone
          ? canSendTransactionalSms
            ? 'Reminder scheduling skipped or failed'
            : 'Customer has not opted into SMS'
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
