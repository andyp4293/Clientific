import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { businessDayStart } from '@/lib/timezone';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { sendAppointmentConfirmation } from '@/lib/twilio';
import { requireActiveSubscription } from '@/lib/subscription';
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

function formatLocalDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('/', '-');
}

function formatDateLabel(dateKey: string, timezone: string) {
  const start = businessDayStart(dateKey, timezone);
  return start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });
}

function formatTimeLabel(isoString: string, timezone: string) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function formatStatusLabel(status: string) {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatSourceLabel(source: string) {
  if (source === 'dashboard') return 'Manual';
  if (source === 'online_booking') return 'Online booking';
  if (source === 'public_booking') return 'Public booking';
  return formatStatusLabel(source);
}

function canSendAppointmentSms(customer: {
  phone: string | null;
  smsConsent: boolean;
  smsOptedOut: boolean;
}) {
  return Boolean(customer.phone) && customer.smsConsent && !customer.smsOptedOut;
}

function isReminderEligibleStatus(status: string) {
  return ['scheduled', 'confirmed'].includes(status);
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
    try {
      session = await verifyMobileSessionToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        id: true,
        email: true,
        name: true,
        businessType: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        timezone: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const selectedDate = searchParams.get('date') || formatLocalDate(new Date(), business.timezone);
    const startOfDay = businessDayStart(selectedDate, business.timezone);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        businessId: business.id,
        startTime: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      take: 40,
    });

    const serviceIds = collectAppointmentServiceIds(appointments);
    const services =
      serviceIds.length > 0
        ? await prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true },
          })
        : [];
    const appointmentsWithServices = withAppointmentServiceDisplay(appointments, services);

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      selectedDate,
      dateLabel: formatDateLabel(selectedDate, business.timezone),
      timezone: business.timezone,
      counts: {
        total: appointmentsWithServices.length,
        pending: appointmentsWithServices.filter((appointment) => appointment.status === 'pending')
          .length,
        confirmed: appointmentsWithServices.filter(
          (appointment) => appointment.status === 'confirmed',
        ).length,
        scheduled: appointmentsWithServices.filter(
          (appointment) => appointment.status === 'scheduled',
        ).length,
      },
      appointments: appointmentsWithServices.map((appointment) => ({
        id: appointment.id,
        customerId: appointment.customer.id,
        customerName: appointment.customer.name,
        serviceId: appointment.service?.id ?? null,
        serviceName: appointment.serviceDisplayName || appointment.service?.name || 'Service',
        staffId: appointment.staff?.id ?? null,
        staffName: appointment.staff?.fullName ?? null,
        status: appointment.status,
        statusLabel: formatStatusLabel(appointment.status),
        startTime: appointment.startTime.toISOString(),
        startTimeLabel: formatTimeLabel(appointment.startTime.toISOString(), business.timezone),
        endTimeLabel: formatTimeLabel(appointment.endTime.toISOString(), business.timezone),
        duration: appointment.duration,
        source: appointment.source,
        sourceLabel: formatSourceLabel(appointment.source),
        notes: appointment.notes,
        canConfirm: appointment.status === 'pending',
        canModify: ['pending', 'scheduled', 'confirmed'].includes(appointment.status),
      })),
    });
  } catch (error) {
    console.error('GET /api/mobile/appointments error:', error);
    return NextResponse.json({ error: 'Unable to load mobile appointments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
    try {
      session = await verifyMobileSessionToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        id: true,
        name: true,
        timezone: true,
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, serviceId, staffId, startTime, notes, appointmentSmsConsent } =
      await request.json();

    if (!customerId || !serviceId || !startTime) {
      return NextResponse.json(
        { error: 'Customer, service, and start time are required' },
        { status: 400 },
      );
    }

    const blockedField = getBlockedFieldLabel([{ label: 'Notes', value: notes }]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const [service, appointmentCustomer] = await Promise.all([
      prisma.service.findFirst({
        where: {
          id: String(serviceId).trim(),
          businessId: business.id,
          active: true,
        },
        select: {
          id: true,
          name: true,
          duration: true,
        },
      }),
      prisma.customer.findFirst({
        where: {
          id: String(customerId).trim(),
          businessId: business.id,
        },
        select: {
          id: true,
          phone: true,
          smsConsent: true,
          smsOptedOut: true,
        },
      }),
    ]);

    if (!service) {
      return NextResponse.json(
        { error: 'Select an active service before creating the appointment.' },
        { status: 400 },
      );
    }

    if (!appointmentCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Select a valid start time.' }, { status: 400 });
    }

    const appointmentDuration = service.duration;
    const end = new Date(start.getTime() + appointmentDuration * 60000);

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
        { status: businessHoursError.status },
      );
    }

    if (staffId) {
      const staffError = await validateBookableStaffSelection({
        staffId,
        businessId: business.id,
        serviceIds: [service.id],
        businessHours: business.businessHours?.hours,
        timezone: business.timezone,
        startTime: start,
        endTime: end,
      });

      if (staffError) {
        return NextResponse.json({ error: staffError.error }, { status: staffError.status });
      }
    }

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
              AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }],
            },
            {
              AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }],
            },
            {
              AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }],
            },
          ],
        },
      });

      if (conflicts.length > 0) {
        return NextResponse.json({ error: 'Time slot is not available' }, { status: 409 });
      }
    }

    if (appointmentSmsConsent === true) {
      if (!appointmentCustomer.phone) {
        return NextResponse.json(
          { error: 'Customer needs a phone number before appointment texts can be enabled' },
          { status: 400 },
        );
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerId: appointmentCustomer.id,
        serviceId: service.id,
        serviceIds: [service.id],
        staffId: staffId || null,
        startTime: start,
        endTime: end,
        duration: appointmentDuration,
        notes: notes || null,
        status: 'scheduled',
        source: 'dashboard',
      },
      include: {
        customer: true,
        service: true,
        staff: true,
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
          source: 'mobile_appointment',
          metadata: {
            consentType: 'transactional',
            consentMethod: 'verbal',
            channel: 'mobile-appointments',
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
      !appointment.customer.smsOptedOut;

    if (canSendTransactionalSms && appointment.customer.phone) {
      const shortId = await ensureAppointmentShortId(appointment.id, appointment.shortId);
      const appBase = getConfiguredAppBaseUrl();
      const appointmentUrl = shortId ? `${appBase}/a/${shortId}` : undefined;

      await sendAppointmentConfirmation(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name || 'Appointment',
        staffName: appointment.staff?.fullName || 'our team',
        dateTime: appointment.startTime,
        businessName: business.name,
        appointmentUrl,
        timezone: business.timezone ?? undefined,
        senderPhone: business.vapiPhoneNumber,
      }).catch((error) => {
        console.warn('Mobile appointment confirmation SMS failed:', error);
      });

      if (isReminderEligibleStatus(appointment.status)) {
        const reminderResult = await scheduleAppointmentReminder(appointment.customer.phone, {
          customerName: appointment.customer.name,
          serviceName: appointment.service?.name || 'Appointment',
          staffName: appointment.staff?.fullName || 'our team',
          dateTime: appointment.startTime,
          businessName: business.name,
          appointmentUrl,
          timezone: business.timezone ?? undefined,
          senderPhone: business.vapiPhoneNumber,
        });

        if (reminderResult.success) {
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: { reminderSent: true },
          });
        }
      }
    }

    return NextResponse.json(
      {
        appointment: {
          id: appointment.id,
          customerId: appointment.customer.id,
          customerName: appointment.customer.name,
          serviceId: appointment.service?.id ?? null,
          serviceName: appointment.service?.name ?? 'Service',
          staffId: appointment.staff?.id ?? null,
          staffName: appointment.staff?.fullName ?? null,
          status: appointment.status,
          statusLabel: formatStatusLabel(appointment.status),
          startTime: appointment.startTime.toISOString(),
          startTimeLabel: formatTimeLabel(appointment.startTime.toISOString(), business.timezone),
          endTimeLabel: formatTimeLabel(appointment.endTime.toISOString(), business.timezone),
          duration: appointment.duration,
          source: appointment.source,
          sourceLabel: formatSourceLabel(appointment.source),
          notes: appointment.notes,
          canConfirm: appointment.status === 'pending',
          canModify: ['pending', 'scheduled', 'confirmed'].includes(appointment.status),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/mobile/appointments error:', error);
    return NextResponse.json({ error: 'Unable to create mobile appointment' }, { status: 500 });
  }
}
