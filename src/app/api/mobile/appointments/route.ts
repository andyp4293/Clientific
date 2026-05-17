import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { businessDayStart, weekdayIndexInTimeZone } from '@/lib/timezone';
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
import { buildAppointmentScheduledNotificationMessage } from '@/lib/appointment-notification-copy';
import { createBusinessNotification } from '@/lib/mobile-push';
import { createOnlineAppointmentBatchToken } from '@/lib/appointment-confirmation-batches';
import {
  buildSegmentServiceStaffSummary,
  buildServiceBookingSegments,
  getUniqueAssignedStaffIds,
  normalizeServiceStaffAssignments,
  ServiceBookingSegment,
  shouldCreateSegmentedServiceBooking,
} from '@/lib/service-staff-assignments';

function buildOverlapWhere(start: Date, end: Date) {
  return [
    {
      AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }],
    },
    {
      AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }],
    },
    {
      AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }],
    },
  ];
}

async function findStaffConflicts({
  businessId,
  segments,
  staffId,
  start,
  end,
}: {
  businessId: string;
  segments?: ServiceBookingSegment[];
  staffId?: string | null;
  start?: Date;
  end?: Date;
}) {
  const assignedSegments = segments?.filter((segment) => segment.staffId) ?? [];

  if (assignedSegments.length > 0) {
    return prisma.appointment.findMany({
      where: {
        businessId,
        status: { in: ['pending', 'scheduled', 'confirmed'] },
        OR: assignedSegments.map((segment) => ({
          staffId: segment.staffId,
          OR: buildOverlapWhere(segment.startTime, segment.endTime),
        })),
      },
    });
  }

  if (!staffId || !start || !end) return [];

  return prisma.appointment.findMany({
    where: {
      businessId,
      staffId,
      status: {
        in: ['scheduled', 'confirmed'],
      },
      OR: buildOverlapWhere(start, end),
    },
  });
}

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

    let staffViewer: { id: string; fullName: string } | null = null;
    if (session.accountType === 'staff') {
      if (!session.staffId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      staffViewer = await prisma.staff.findFirst({
        where: {
          id: session.staffId,
          businessId: business.id,
          active: true,
          portalAccessEnabled: true,
        },
        select: {
          id: true,
          fullName: true,
        },
      });

      if (!staffViewer) {
        return NextResponse.json({ error: 'Employee app access is disabled.' }, { status: 403 });
      }
    }

    const searchParams = new URL(request.url).searchParams;
    const selectedDate = searchParams.get('date') || formatLocalDate(new Date(), business.timezone);
    const startOfDay = businessDayStart(selectedDate, business.timezone);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        businessId: business.id,
        ...(staffViewer ? { staffId: staffViewer.id } : {}),
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
      viewer: staffViewer
        ? {
            role: 'staff',
            staffId: staffViewer.id,
            staffName: staffViewer.fullName,
            privacy: 'customer_phone_hidden',
          }
        : { role: 'owner' },
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
        canConfirm: !staffViewer && appointment.status === 'pending',
        canModify: !staffViewer && ['pending', 'scheduled', 'confirmed'].includes(appointment.status),
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

    if (session.accountType === 'staff') {
      return NextResponse.json(
        { error: 'Employee accounts can only view assigned appointments.' },
        { status: 403 },
      );
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

    const {
      customerId,
      serviceId,
      serviceIds: rawServiceIds,
      serviceStaffAssignments: rawServiceStaffAssignments,
      staffId,
      startTime,
      notes,
      appointmentSmsConsent,
    } =
      await request.json();

    const serviceIds = Array.from(
      new Set(
        [
          ...(Array.isArray(rawServiceIds) ? rawServiceIds : []),
          ...(typeof serviceId === 'string' ? [serviceId] : []),
        ]
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    if (!customerId || serviceIds.length === 0 || !startTime) {
      return NextResponse.json(
        { error: 'Customer, service, and start time are required' },
        { status: 400 },
      );
    }

    if (serviceIds.length > 20) {
      return NextResponse.json({ error: 'Please select 20 services or fewer' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([{ label: 'Notes', value: notes }]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const [services, appointmentCustomer] = await Promise.all([
      prisma.service.findMany({
        where: {
          id: { in: serviceIds },
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

    if (services.length !== serviceIds.length) {
      return NextResponse.json(
        { error: 'Select active services before creating the appointment.' },
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

    const servicesById = new Map(services.map((service) => [service.id, service]));
    const orderedServices = serviceIds
      .map((selectedServiceId) => servicesById.get(selectedServiceId))
      .filter((service): service is (typeof services)[number] => Boolean(service));
    const totalServiceDuration = orderedServices.reduce((sum, service) => sum + service.duration, 0);
    const serviceStaffAssignments = normalizeServiceStaffAssignments(
      rawServiceStaffAssignments,
      serviceIds,
    );
    const createSegmentedAppointments = shouldCreateSegmentedServiceBooking({
      assignments: serviceStaffAssignments,
      orderedServiceIds: serviceIds,
    });
    const segments = createSegmentedAppointments
      ? buildServiceBookingSegments({
          assignments: serviceStaffAssignments,
          orderedServices,
          startTime: start,
        })
      : [];
    const appointmentDuration = createSegmentedAppointments
      ? totalServiceDuration
      : totalServiceDuration;
    const end = createSegmentedAppointments
      ? segments[segments.length - 1]?.endTime
      : new Date(start.getTime() + appointmentDuration * 60000);

    if (!end || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Select a valid appointment time.' }, { status: 400 });
    }

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

    if (createSegmentedAppointments) {
      for (const segment of segments) {
        if (!segment.staffId) continue;

        const staffError = await validateBookableStaffSelection({
          staffId: segment.staffId,
          businessId: business.id,
          serviceIds: [segment.serviceId],
          dayOfWeek: weekdayIndexInTimeZone(segment.startTime, business.timezone),
          businessHours: business.businessHours?.hours,
          timezone: business.timezone,
          startTime: segment.startTime,
          endTime: segment.endTime,
        });

        if (staffError) {
          return NextResponse.json({ error: staffError.error }, { status: staffError.status });
        }
      }
    } else if (staffId) {
      const staffError = await validateBookableStaffSelection({
        staffId,
        businessId: business.id,
        serviceIds,
        businessHours: business.businessHours?.hours,
        timezone: business.timezone,
        startTime: start,
        endTime: end,
      });

      if (staffError) {
        return NextResponse.json({ error: staffError.error }, { status: staffError.status });
      }
    }

    const conflicts = await findStaffConflicts({
      businessId: business.id,
      segments: createSegmentedAppointments ? segments : undefined,
      staffId,
      start,
      end,
    });

    if (conflicts.length > 0) {
      return NextResponse.json({ error: 'Time slot is not available' }, { status: 409 });
    }

    if (appointmentSmsConsent === true) {
      if (!appointmentCustomer.phone) {
        return NextResponse.json(
          { error: 'Customer needs a phone number before appointment texts can be enabled' },
          { status: 400 },
        );
      }
    }

    const appointmentInclude = {
      customer: true,
      service: true,
      staff: true,
    } as const;

    const createAppointmentData = (segment?: ServiceBookingSegment) => {
      const appointmentServiceIds = segment ? [segment.serviceId] : serviceIds;
      return {
        businessId: business.id,
        customerId: appointmentCustomer.id,
        serviceId: appointmentServiceIds[0],
        serviceIds: appointmentServiceIds,
        staffId: segment ? segment.staffId : staffId || null,
        startTime: segment?.startTime ?? start,
        endTime: segment?.endTime ?? end,
        duration: segment?.duration ?? appointmentDuration,
        notes: notes || null,
        status: 'scheduled',
        source: 'dashboard',
      };
    };

    const appointments = createSegmentedAppointments
      ? await (typeof prisma.$transaction === 'function'
          ? prisma.$transaction(
              segments.map((segment) =>
                prisma.appointment.create({
                  data: createAppointmentData(segment),
                  include: appointmentInclude,
                })
              )
            )
          : Promise.all(
              segments.map((segment) =>
                prisma.appointment.create({
                  data: createAppointmentData(segment),
                  include: appointmentInclude,
                })
              )
            ))
      : [
          await prisma.appointment.create({
            data: createAppointmentData(),
            include: appointmentInclude,
          }),
        ];
    const appointment = appointments[0];

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
            appointmentIds: appointments.map((createdAppointment) => createdAppointment.id),
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

    if (canSendTransactionalSms && appointment.customer.phone) {
      const appBase = getConfiguredAppBaseUrl();
      const shortId = createSegmentedAppointments
        ? null
        : await ensureAppointmentShortId(appointment.id, appointment.shortId);
      const appointmentUrl = createSegmentedAppointments
        ? `${appBase}/appt/batch/${createOnlineAppointmentBatchToken({
            b: business.id,
            a: appointments.map((createdAppointment) => createdAppointment.id),
          })}`
        : shortId
          ? `${appBase}/a/${shortId}`
          : undefined;
      const staffNamesById = new Map<string, string>(
        appointments
          .flatMap((createdAppointment) =>
            createdAppointment.staff ? [createdAppointment.staff] : []
          )
          .map((staff) => [staff.id, staff.fullName])
      );
      const serviceName = createSegmentedAppointments
        ? buildSegmentServiceStaffSummary({ segments, staffNamesById })
        : appointment.service?.name || orderedServices.map((service) => service.name).join(', ') || 'Appointment';
      const staffName = createSegmentedAppointments
        ? 'our team'
        : appointment.staff?.fullName || 'our team';

      await sendAppointmentConfirmation(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName,
        staffName,
        dateTime: appointment.startTime,
        businessName: business.name,
        duration: appointmentDuration,
        appointmentUrl,
        timezone: business.timezone ?? undefined,
        senderPhone: business.vapiPhoneNumber,
      }).catch((error) => {
        console.warn('Mobile appointment confirmation SMS failed:', error);
      });

      if (isReminderEligibleStatus(appointment.status)) {
        const reminderResult = await scheduleAppointmentReminder(appointment.customer.phone, {
          customerName: appointment.customer.name,
          serviceName,
          staffName,
          dateTime: appointment.startTime,
          businessName: business.name,
          appointmentUrl,
          timezone: business.timezone ?? undefined,
          senderPhone: business.vapiPhoneNumber,
        });

        if (reminderResult.success) {
          await Promise.all(
            appointments.map((createdAppointment) =>
              prisma.appointment.update({
                where: { id: createdAppointment.id },
                data: { reminderSent: true },
              })
            )
          );
        }
      }
    }

    const assignedStaffIds = getUniqueAssignedStaffIds(segments);
    const notificationStaffNamesById = new Map<string, string>(
      appointments
        .flatMap((createdAppointment) =>
          createdAppointment.staff ? [createdAppointment.staff] : []
        )
        .map((staff) => [staff.id, staff.fullName])
    );
    const notificationServiceName = createSegmentedAppointments
      ? buildSegmentServiceStaffSummary({ segments, staffNamesById: notificationStaffNamesById })
      : appointment.service?.name || orderedServices.map((service) => service.name).join(', ') || 'Appointment';
    await createBusinessNotification({
      businessId: business.id,
      staffId: appointment.staff?.id ?? null,
      staffIds: assignedStaffIds,
      type: 'new_appointment',
      title: createSegmentedAppointments ? 'New Multi-Service Appointment' : 'New Appointment',
      message: buildAppointmentScheduledNotificationMessage({
        customerName: appointment.customer.name,
        serviceName: notificationServiceName,
        staffName: createSegmentedAppointments ? null : (appointment.staff?.fullName ?? null),
        startTime: appointment.startTime,
        timezone: business.timezone,
      }),
      link: '/dashboard/appointments',
    });

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
        appointments: appointments.map((createdAppointment) => ({
          id: createdAppointment.id,
          customerId: createdAppointment.customer.id,
          customerName: createdAppointment.customer.name,
          serviceId: createdAppointment.service?.id ?? null,
          serviceName: createdAppointment.service?.name ?? 'Service',
          staffId: createdAppointment.staff?.id ?? null,
          staffName: createdAppointment.staff?.fullName ?? null,
          status: createdAppointment.status,
          statusLabel: formatStatusLabel(createdAppointment.status),
          startTime: createdAppointment.startTime.toISOString(),
          startTimeLabel: formatTimeLabel(createdAppointment.startTime.toISOString(), business.timezone),
          endTimeLabel: formatTimeLabel(createdAppointment.endTime.toISOString(), business.timezone),
          duration: createdAppointment.duration,
          source: createdAppointment.source,
          sourceLabel: formatSourceLabel(createdAppointment.source),
          notes: createdAppointment.notes,
          canConfirm: createdAppointment.status === 'pending',
          canModify: ['pending', 'scheduled', 'confirmed'].includes(createdAppointment.status),
        })),
        appointmentBatchUrl: createSegmentedAppointments
          ? `${getConfiguredAppBaseUrl()}/appt/batch/${createOnlineAppointmentBatchToken({
              b: business.id,
              a: appointments.map((createdAppointment) => createdAppointment.id),
            })}`
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/mobile/appointments error:', error);
    return NextResponse.json({ error: 'Unable to create mobile appointment' }, { status: 500 });
  }
}
