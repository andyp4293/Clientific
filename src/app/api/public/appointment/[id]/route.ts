import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { validateBusinessHoursForAppointment } from '@/lib/business-hours-validation';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import { validateBookableStaffSelection } from '@/lib/staff-service-validation';
import { weekdayIndexInTimeZone } from '@/lib/timezone';
import {
  type ReminderDetails,
  sendAppointmentCancellation,
  sendAppointmentConfirmation,
} from '@/lib/twilio';
import { cancelScheduledAppointmentReminder } from '@/lib/appointment-reminders';
import { resolveAppointmentServiceDisplayName } from '@/lib/appointment-services';
import { createBusinessNotification } from '@/lib/mobile-push';
import { buildAppointmentRescheduledNotificationMessage } from '@/lib/appointment-notification-copy';

async function resolveServiceName(
  serviceIds: string[],
  fallbackServiceName?: string | null,
) {
  if (!serviceIds.length) {
    return fallbackServiceName ?? 'Appointment';
  }

  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });

  return (
    resolveAppointmentServiceDisplayName(
      {
        serviceIds,
        service: fallbackServiceName ? { name: fallbackServiceName } : undefined,
      },
      services,
    ) ?? fallbackServiceName ?? 'Appointment'
  );
}

async function cancelExistingReminder(
  phone: string | null,
  details: ReminderDetails,
) {
  if (!phone) {
    return;
  }

  await cancelScheduledAppointmentReminder(phone, details);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      duration: true,
      notes: true,
      serviceIds: true,
      staffId: true,
      service: { select: { name: true, price: true } },
      staff: { select: { fullName: true } },
      business: {
        select: {
          id: true,
          name: true,
          phone: true,
          notifyNewBookingEmail: true,
          timezone: true,
          slug: true,
          publicId: true,
        },
      },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  let services: { name: string; price: number | null }[] = [];
  if (appointment.serviceIds.length > 0) {
    services = await prisma.service.findMany({
      where: { id: { in: appointment.serviceIds } },
      select: { name: true, price: true },
    });
  } else if (appointment.service) {
    services = [appointment.service];
  }
  const totalPrice = services.reduce((sum, service) => sum + (service.price ?? 0), 0);

  const session = await getServerSession(authOptions);
  const sessionBusinessId = getSessionBusinessId(session);
  const { id: businessId, ...publicBusiness } = appointment.business;

  return NextResponse.json({
    appointment: { ...appointment, business: publicBusiness, services, totalPrice },
    viewerCanManage: sessionBusinessId === businessId,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, startTime } = body;

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: {
      status: true,
      startTime: true,
      reminderSent: true,
      shortId: true,
      serviceId: true,
      serviceIds: true,
      staffId: true,
      staff: { select: { fullName: true } },
      service: { select: { name: true } },
      customer: {
        select: {
          name: true,
          phone: true,
          smsConsent: true,
          smsOptedOut: true,
        },
      },
      business: {
        select: {
          name: true,
          notifyNewBookingEmail: true,
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
      },
      businessId: true,
      duration: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  if (existing.status === 'cancelled') {
    return NextResponse.json({ error: 'Appointment already cancelled' }, { status: 409 });
  }

  if (startTime) {
    const newStart = new Date(startTime);
    if (Number.isNaN(newStart.getTime())) {
      return NextResponse.json({ error: 'Invalid start time' }, { status: 400 });
    }

    const newEnd = new Date(newStart.getTime() + existing.duration * 60 * 1000);
    const requestedServiceIds = Array.from(
      new Set(
        [
          ...(Array.isArray(existing.serviceIds) ? existing.serviceIds : []),
          ...(existing.serviceId ? [existing.serviceId] : []),
        ].filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    );
    const serviceName = await resolveServiceName(requestedServiceIds, existing.service?.name);
    const appBaseUrl = getConfiguredAppBaseUrl();
    const appointmentUrl = existing.shortId ? `${appBaseUrl}/a/${existing.shortId}` : undefined;

    const businessHoursError = validateBusinessHoursForAppointment({
      startTime: newStart,
      endTime: newEnd,
      timezone: existing.business.timezone,
      businessHours: existing.business.businessHours?.hours,
      closureDates: existing.business.closureDates,
    });

    if (businessHoursError) {
      return NextResponse.json(
        { error: businessHoursError.error },
        { status: businessHoursError.status }
      );
    }

    if (existing.staffId) {
      const staffError = await validateBookableStaffSelection({
        staffId: existing.staffId,
        businessId: existing.businessId,
        serviceIds: requestedServiceIds,
        dayOfWeek: weekdayIndexInTimeZone(newStart, existing.business.timezone),
        businessHours: existing.business.businessHours?.hours,
        timezone: existing.business.timezone,
        startTime: newStart,
        endTime: newEnd,
      });

      if (staffError) {
        return NextResponse.json({ error: staffError.error }, { status: staffError.status });
      }

      const conflict = await prisma.appointment.findFirst({
        where: {
          businessId: existing.businessId,
          staffId: existing.staffId,
          status: { in: ['pending', 'scheduled', 'confirmed'] },
          id: { not: id },
          startTime: { lt: newEnd },
          endTime: { gt: newStart },
        },
      });

      if (conflict) {
        return NextResponse.json(
          { error: 'That time slot is no longer available' },
          { status: 409 }
        );
      }
    }

    if (existing.customer.smsConsent && !existing.customer.smsOptedOut) {
      await cancelExistingReminder(existing.customer.phone, {
        customerName: existing.customer.name,
        serviceName,
        staffName: existing.staff?.fullName || 'our team',
        dateTime: existing.startTime,
        businessName: existing.business.name,
        appointmentUrl,
        timezone: existing.business.timezone,
        senderPhone: existing.business.vapiPhoneNumber,
      });
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        startTime: newStart,
        endTime: newEnd,
        status: 'pending',
        confirmationSent: false,
        reminderSent: false,
      },
    });

    if (existing.customer.phone && existing.customer.smsConsent && !existing.customer.smsOptedOut) {
      sendAppointmentConfirmation(existing.customer.phone, {
        customerName: existing.customer.name,
        serviceName,
        staffName: existing.staff?.fullName || 'our team',
        dateTime: newStart,
        businessName: existing.business.name,
        duration: existing.duration,
        appointmentUrl,
        timezone: existing.business.timezone,
        senderPhone: existing.business.vapiPhoneNumber,
      }).catch((err) => console.warn('Reschedule request SMS failed:', err));
    }

    await createBusinessNotification({
      businessId: existing.businessId,
      staffId: existing.staffId,
      type: 'appointment_rescheduled',
      title: 'Appointment Reschedule Request',
      message: buildAppointmentRescheduledNotificationMessage({
        customerName: existing.customer.name,
        serviceName,
        staffName: existing.staff?.fullName ?? null,
        startTime: newStart,
        timezone: existing.business.timezone,
      }),
      link: '/dashboard/appointments',
      sendPush: existing.business.notifyNewBookingEmail !== false,
    });

    return NextResponse.json({ appointment });
  }

  if (status !== 'cancelled') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  if (existing.customer.phone && existing.customer.smsConsent && !existing.customer.smsOptedOut) {
    const requestedServiceIds = Array.from(
      new Set(
        [
          ...(Array.isArray(existing.serviceIds) ? existing.serviceIds : []),
          ...(existing.serviceId ? [existing.serviceId] : []),
        ].filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    );
    const serviceName = await resolveServiceName(requestedServiceIds, existing.service?.name);
    const appBaseUrl = getConfiguredAppBaseUrl();
    const appointmentUrl = existing.shortId ? `${appBaseUrl}/a/${existing.shortId}` : undefined;

    await cancelExistingReminder(existing.customer.phone, {
      customerName: existing.customer.name,
      serviceName,
      staffName: existing.staff?.fullName || 'our team',
      dateTime: existing.startTime,
      businessName: existing.business.name,
      appointmentUrl,
      timezone: existing.business.timezone ?? undefined,
      senderPhone: existing.business.vapiPhoneNumber,
    });

    sendAppointmentCancellation(existing.customer.phone, {
      customerName: existing.customer.name,
      serviceName,
      dateTime: existing.startTime,
      businessName: existing.business.name,
      timezone: existing.business.timezone ?? undefined,
      senderPhone: existing.business.vapiPhoneNumber,
    }).catch((err) => console.warn('Cancellation SMS failed:', err));
  }

  return NextResponse.json({ appointment });
}
