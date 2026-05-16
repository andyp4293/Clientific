import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendAppointmentConfirmation } from '@/lib/twilio';
import {
  buildCustomerPhoneData,
  buildCustomerPhoneMatchClauses,
  normalizeStoredPhoneNumber,
} from '@/lib/phone';
import { sendNewBookingEmail } from '@/lib/email';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { validateBusinessHoursForAppointment } from '@/lib/business-hours-validation';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { createBusinessNotification } from '@/lib/mobile-push';
import { validateBookableStaffSelection } from '@/lib/staff-service-validation';
import { weekdayIndexInTimeZone } from '@/lib/timezone';
import { buildPublicBookingConsentMetadata } from '@/lib/public-booking-sms-consent';
import { buildAppointmentBookedNotificationMessage } from '@/lib/appointment-notification-copy';
import { createOnlineAppointmentBatchToken } from '@/lib/appointment-confirmation-batches';
import {
  buildSegmentServiceStaffSummary,
  buildServiceBookingSegments,
  getUniqueAssignedStaffIds,
  normalizeServiceStaffAssignments,
  ServiceBookingSegment,
  shouldCreateSegmentedServiceBooking,
} from '@/lib/service-staff-assignments';

type PublicBusinessLookup = { slug: string } | { publicId: string };

type PublicBookingHandlerInput = {
  businessLookup: PublicBusinessLookup;
  consentChannel: string;
  req: NextRequest;
};

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
      status: { in: ['pending', 'scheduled', 'confirmed'] },
      OR: buildOverlapWhere(start, end),
    },
  });
}

export async function handlePublicBookingRequest({
  businessLookup,
  consentChannel,
  req,
}: PublicBookingHandlerInput) {
  try {
    const business = await prisma.business.findUnique({
      where: businessLookup,
      select: {
        id: true,
        enableOnlineBooking: true,
        email: true,
        name: true,
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

    if (!business.enableOnlineBooking) {
      return NextResponse.json({ error: 'Online booking is not enabled' }, { status: 403 });
    }

    const {
      serviceIds: rawServiceIds,
      serviceId: rawServiceId,
      serviceStaffAssignments: rawServiceStaffAssignments,
      staffId,
      startTime,
      duration,
      customerName,
      customerPhone,
      customerEmail,
      notes,
      smsConsent,
      smsMarketingConsent,
    } = await req.json();

    const transactionalConsent = true;
    const marketingConsent = Boolean(smsMarketingConsent);
    const submittedSmsConsentField = Boolean(smsConsent);
    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      null;
    const userAgent = req.headers.get('user-agent');

    const serviceIds = Array.from(
      new Set(
        [
          ...(Array.isArray(rawServiceIds) ? rawServiceIds : []),
          ...(typeof rawServiceId === 'string' ? [rawServiceId] : []),
        ]
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    if (!serviceIds.length || !startTime || !duration || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: 'Service, start time, duration, name, and phone are required' },
        { status: 400 }
      );
    }

    if (serviceIds.length > 20) {
      return NextResponse.json({ error: 'Please select 20 services or fewer' }, { status: 400 });
    }
    if (typeof customerName !== 'string' || customerName.trim().length === 0 || customerName.length > 100) {
      return NextResponse.json({ error: 'Name must be 1–100 characters' }, { status: 400 });
    }
    if (customerPhone && (typeof customerPhone !== 'string' || customerPhone.length > 30)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    if (customerEmail && (typeof customerEmail !== 'string' || customerEmail.length > 254)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (notes && (typeof notes !== 'string' || notes.length > 1000)) {
      return NextResponse.json({ error: 'Notes must be 1000 characters or less' }, { status: 400 });
    }
    if (typeof duration !== 'number' || duration < 5 || duration > 480) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Customer name', value: customerName },
      { label: 'Notes', value: notes },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const normalizedCustomerPhone = normalizeStoredPhoneNumber(customerPhone) || customerPhone.trim();
    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        businessId: business.id,
      },
    });

    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: 'One or more services not found' }, { status: 404 });
    }

    const servicesById = new Map(services.map((service) => [service.id, service]));
    const orderedServices = serviceIds
      .map((serviceId) => servicesById.get(serviceId))
      .filter((service): service is (typeof services)[number] => Boolean(service));
    const totalServiceDuration = orderedServices.reduce((sum, service) => sum + service.duration, 0);
    const serviceStaffAssignments = normalizeServiceStaffAssignments(rawServiceStaffAssignments, serviceIds);
    const createSegmentedAppointments = shouldCreateSegmentedServiceBooking({
      assignments: serviceStaffAssignments,
      orderedServiceIds: serviceIds,
    });

    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Invalid start time' }, { status: 400 });
    }

    const segments = createSegmentedAppointments
      ? buildServiceBookingSegments({
          assignments: serviceStaffAssignments,
          orderedServices,
          startTime: start,
        })
      : [];
    const effectiveDuration = createSegmentedAppointments ? totalServiceDuration : duration;
    const end = createSegmentedAppointments
      ? segments[segments.length - 1]?.endTime
      : new Date(start.getTime() + duration * 60_000);

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
    } else if (staffId && staffId !== 'anyone') {
      const staffError = await validateBookableStaffSelection({
        staffId,
        businessId: business.id,
        serviceIds,
        dayOfWeek: weekdayIndexInTimeZone(start, business.timezone),
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
      return NextResponse.json({ error: 'Time slot is no longer available' }, { status: 409 });
    }

    const customerPhoneData = buildCustomerPhoneData(customerPhone);

    let customer = await prisma.customer.findFirst({
      where: {
        businessId: business.id,
        OR: buildCustomerPhoneMatchClauses(customerPhone),
      },
    });
    let consentApplied = true;

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId: business.id,
          name: customerName,
          phone: customerPhoneData.phone,
          phoneLookupKey: customerPhoneData.phoneLookupKey,
          email: customerEmail || null,
          smsConsent: transactionalConsent,
          smsMarketingConsent: marketingConsent,
          smsMarketingConsentAt: marketingConsent ? new Date() : null,
        },
      });
    } else {
      consentApplied = !customer.smsOptedOut;
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: customerName,
          phone: customerPhoneData.phone ?? customer.phone,
          phoneLookupKey: customerPhoneData.phoneLookupKey ?? customer.phoneLookupKey,
          ...(customerEmail && { email: customerEmail }),
          ...(transactionalConsent && !customer.smsOptedOut && { smsConsent: true }),
          ...(marketingConsent && !customer.smsOptedOut
            ? {
                smsMarketingConsent: true,
                smsMarketingConsentAt: new Date(),
              }
            : {}),
        },
      });
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

    const appBase = getConfiguredAppBaseUrl();
    const createAppointmentData = (segment?: ServiceBookingSegment) => {
      const appointmentServiceIds = segment ? [segment.serviceId] : serviceIds;
      return {
        businessId: business.id,
        customerId: customer.id,
        serviceId: appointmentServiceIds[0],
        serviceIds: appointmentServiceIds,
        staffId: segment
          ? segment.staffId
          : staffId && staffId !== 'anyone'
            ? staffId
            : null,
        startTime: segment?.startTime ?? start,
        endTime: segment?.endTime ?? end,
        duration: segment?.duration ?? effectiveDuration,
        notes: notes || null,
        status: 'pending',
        shortId: Math.random().toString(36).substring(2, 9).toUpperCase(),
        source: 'online',
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

    await prisma.smsConsentEvent.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        phone: customer.phone || normalizedCustomerPhone,
        eventType: 'FORM_OPT_IN',
        source: 'booking_form',
        ipAddress,
        userAgent,
        metadata: buildPublicBookingConsentMetadata({
          businessName: business.name,
          channel: consentChannel,
          consentApplied,
          ipAddress,
          marketingConsent,
          submittedSmsConsentField,
          userAgent,
        }),
      },
    });

    const assignedStaffIds = getUniqueAssignedStaffIds(segments);
    const staffNamesById = new Map<string, string>(
      appointments
        .flatMap((createdAppointment) =>
          createdAppointment.staff ? [createdAppointment.staff] : []
        )
        .map((staff) => [staff.id, staff.fullName])
    );
    const serviceName = createSegmentedAppointments
      ? buildSegmentServiceStaffSummary({ segments, staffNamesById })
      : orderedServices.map((service) => service.name).join(', ');
    const staffName = createSegmentedAppointments
      ? null
      : appointment.staff?.fullName || null;
    const appointmentUrl = createSegmentedAppointments
      ? `${appBase}/appt/batch/${createOnlineAppointmentBatchToken({
          b: business.id,
          a: appointments.map((createdAppointment) => createdAppointment.id),
        })}`
      : `${appBase}/a/${appointment.shortId}`;

    let smsResult = null;
    if (customer.phone && transactionalConsent && !customer.smsOptedOut) {
      smsResult = await sendAppointmentConfirmation(customer.phone, {
        customerName: customer.name,
        serviceName,
        staffName: staffName || 'our team',
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        duration: effectiveDuration,
        appointmentUrl,
        timezone: business.timezone ?? undefined,
        senderPhone: business.vapiPhoneNumber,
      });

      if (smsResult.success) {
        console.log('✅ SMS confirmation sent to:', customer.phone);
      } else {
        console.warn('⚠️  SMS failed:', smsResult.error);
      }
    }

    if (business.notifyNewBookingEmail !== false) {
      sendNewBookingEmail(business.email, {
        businessName: business.name,
        customerName: customer.name,
        customerPhone: customer.phone,
        serviceName,
        staffName,
        dateTime: appointment.startTime,
        duration: effectiveDuration,
        notes: appointment.notes,
        appointmentUrl: `${appBase}/dashboard/appointments`,
        timezone: business.timezone,
      }).catch(() => {});
    }

    await createBusinessNotification({
      businessId: business.id,
      staffId: appointment.staff?.id ?? null,
      staffIds: assignedStaffIds,
      type: 'new_appointment',
      title: createSegmentedAppointments ? 'New Multi-Service Booking' : 'New Booking Request',
      message: buildAppointmentBookedNotificationMessage({
        customerName: customer.name,
        serviceName,
        staffName,
        startTime: appointment.startTime,
        timezone: business.timezone,
      }),
      link: '/dashboard/appointments',
      sendPush: business.notifyNewBookingEmail !== false,
    });

    return NextResponse.json({
      success: true,
      appointment,
      appointments,
      appointmentBatchUrl: createSegmentedAppointments ? appointmentUrl : null,
      message: createSegmentedAppointments
        ? 'Appointment requests submitted! The business will confirm each service shortly.'
        : 'Appointment request submitted! The business will confirm shortly.',
      smsNotification: smsResult?.success
        ? 'Confirmation SMS sent'
        : customer.phone
          ? 'SMS notification failed'
          : 'No phone number provided',
      smsDebug: {
        attempted: !!(customer.phone && transactionalConsent),
        consentGiven: !!transactionalConsent,
        hasPhone: !!customer.phone,
        error: smsResult?.error || null,
        sid: smsResult?.sid || null,
      },
    });
  } catch (error: any) {
    console.error('Create booking error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}
