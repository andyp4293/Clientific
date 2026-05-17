import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { sendAppointmentConfirmation } from '@/lib/twilio';
import { sendNewBookingEmail } from '@/lib/email';
import { businessDayStart, weekdayIndexInTimeZone } from '@/lib/timezone';
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
import { createOnlineAppointmentBatchToken } from '@/lib/appointment-confirmation-batches';
import {
  buildSegmentServiceStaffSummary,
  buildServiceBookingSegments,
  getUniqueAssignedStaffIds,
  normalizeServiceStaffAssignments,
  ServiceBookingSegment,
  shouldCreateSegmentedServiceBooking,
} from '@/lib/service-staff-assignments';

const businessMidnightUTC = businessDayStart;

function buildOverlapWhere(start: Date, end: Date) {
  return [
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

  if (!staffId || staffId === 'anyone' || !start || !end) return [];

  return prisma.appointment.findMany({
    where: {
      businessId,
      staffId,
      status: { in: ['scheduled', 'confirmed'] },
      OR: buildOverlapWhere(start, end),
    },
  });
}

// GET - List appointments
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.accountType === 'staff') {
      return NextResponse.json(
        { error: 'Employee accounts can only view assigned appointments.' },
        { status: 403 },
      );
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

    if (session.user.accountType === 'staff') {
      return NextResponse.json(
        { error: 'Employee accounts can only view assigned appointments.' },
        { status: 403 },
      );
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
      serviceIds: rawServiceIds,
      serviceStaffAssignments: rawServiceStaffAssignments,
      staffId,
      startTime,
      duration,
      notes,
      appointmentSmsConsent,
    } = await req.json();

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

    if (!customerId || !startTime || !duration) {
      return NextResponse.json(
        { error: 'Customer, start time, and duration are required' },
        { status: 400 }
      );
    }

    if (serviceIds.length > 20) {
      return NextResponse.json({ error: 'Please select 20 services or fewer' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([{ label: 'Notes', value: notes }]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const services = serviceIds.length > 0
      ? await prisma.service.findMany({
          where: {
            id: { in: serviceIds },
            businessId: business.id,
          },
          select: {
            id: true,
            name: true,
            duration: true,
          },
        })
      : [];

    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: 'One or more services not found' }, { status: 404 });
    }

    const servicesById = new Map(services.map((service) => [service.id, service]));
    const orderedServices = serviceIds
      .map((selectedServiceId) => servicesById.get(selectedServiceId))
      .filter((service): service is (typeof services)[number] => Boolean(service));
    const totalServiceDuration = orderedServices.reduce((sum, service) => sum + service.duration, 0);
    const serviceStaffAssignments = normalizeServiceStaffAssignments(
      rawServiceStaffAssignments,
      serviceIds
    );
    const createSegmentedAppointments = shouldCreateSegmentedServiceBooking({
      assignments: serviceStaffAssignments,
      orderedServiceIds: serviceIds,
    });

    const start = new Date(startTime);
    const segments = createSegmentedAppointments
      ? buildServiceBookingSegments({
          assignments: serviceStaffAssignments,
          orderedServices,
          startTime: start,
        })
      : [];
    const effectiveDuration = createSegmentedAppointments
      ? totalServiceDuration
      : serviceIds.length > 0 && totalServiceDuration > 0
        ? totalServiceDuration
        : duration;
    const end = createSegmentedAppointments
      ? segments[segments.length - 1]?.endTime
      : new Date(start.getTime() + effectiveDuration * 60000);

    if (!end || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid appointment time' }, { status: 400 });
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
        { status: businessHoursError.status }
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
      return NextResponse.json(
        { error: 'Time slot is not available' },
        { status: 409 }
      );
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

    const appointmentInclude = {
      customer: true,
      service: true,
      staff: true,
      business: {
        select: {
          name: true,
        },
      },
    } as const;

    const createAppointmentData = (segment?: ServiceBookingSegment) => {
      const appointmentServiceIds = segment ? [segment.serviceId] : serviceIds;
      return {
        businessId: business.id,
        customerId,
        serviceId: appointmentServiceIds[0] || null,
        serviceIds: appointmentServiceIds,
        staffId: segment ? segment.staffId : staffId || null,
        startTime: segment?.startTime ?? start,
        endTime: segment?.endTime ?? end,
        duration: segment?.duration ?? effectiveDuration,
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
          source: 'dashboard_appointment',
          metadata: {
            consentType: 'transactional',
            consentMethod: 'verbal',
            channel: 'dashboard-appointments',
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

    // Send SMS confirmation
    let smsResult = null;
    let reminderResult = null;
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

      smsResult = await sendAppointmentConfirmation(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName,
        staffName,
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        duration: effectiveDuration,
        appointmentUrl,
        timezone: business.timezone,
        senderPhone: business.vapiPhoneNumber,
      });

      if (smsResult.success) {
        console.log('✅ SMS confirmation sent to:', appointment.customer.phone);
      }

      reminderResult = await scheduleAppointmentReminder(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName,
        staffName,
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        appointmentUrl,
        timezone: business.timezone,
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

    // Create notification
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
      : ((appointment.service?.name ?? orderedServices.map((service) => service.name).join(', ')) || 'Appointment');
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
      sendPush: business.notifyNewBookingEmail !== false,
    });

    // Send email to business owner (non-blocking)
    if (business.notifyNewBookingEmail !== false) {
      const appBase = getConfiguredAppBaseUrl();
      sendNewBookingEmail(business.email, {
        businessName: business.name,
        customerName: appointment.customer.name,
        customerPhone: appointment.customer.phone,
        serviceName: notificationServiceName,
        staffName: createSegmentedAppointments ? null : appointment.staff?.fullName || null,
        dateTime: appointment.startTime,
        duration: effectiveDuration,
        notes: appointment.notes,
        appointmentUrl: `${appBase}/dashboard/appointments`,
        timezone: business.timezone,
      }).catch(() => {});
    }

    revalidateTag(`dashboard-stats-${business.id}`, {});
    return NextResponse.json({
      appointment,
      appointments,
      appointmentBatchUrl: createSegmentedAppointments
        ? `${getConfiguredAppBaseUrl()}/appt/batch/${createOnlineAppointmentBatchToken({
            b: business.id,
            a: appointments.map((createdAppointment) => createdAppointment.id),
          })}`
        : null,
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
