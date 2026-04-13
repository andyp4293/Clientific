import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import { sendAppointmentBusinessConfirmed, sendAppointmentCancellation } from '@/lib/twilio';
import { updateCustomerSegment } from '@/lib/segment';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import {
  cancelScheduledAppointmentReminder,
  scheduleAppointmentReminder,
} from '@/lib/appointment-reminders';
import { ensureAppointmentShortId } from '@/lib/appointment-short-id';
import { resolveAppointmentServiceDisplayName } from '@/lib/appointment-services';

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

function formatTimeLabel(isoString: string, timezone: string) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

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
    ) ??
    fallbackServiceName ??
    'Appointment'
  );
}

function toMobileAppointment(
  appointment: {
    id: string;
    customerId: string;
    duration: number;
    notes: string | null;
    status: string;
    startTime: Date;
    source: string;
    service?: { id: string; name: string } | null;
    staff?: { id: string; fullName: string } | null;
    customer: { id: string; name: string };
  },
  timezone: string,
  serviceName: string,
) {
  const endTime = new Date(appointment.startTime.getTime() + appointment.duration * 60000);

  return {
    id: appointment.id,
    customerId: appointment.customer.id,
    customerName: appointment.customer.name,
    serviceId: appointment.service?.id ?? null,
    serviceName,
    staffId: appointment.staff?.id ?? null,
    staffName: appointment.staff?.fullName ?? null,
    status: appointment.status,
    statusLabel: formatStatusLabel(appointment.status),
    startTime: appointment.startTime.toISOString(),
    startTimeLabel: formatTimeLabel(appointment.startTime.toISOString(), timezone),
    endTimeLabel: formatTimeLabel(endTime.toISOString(), timezone),
    duration: appointment.duration,
    source: appointment.source,
    sourceLabel: formatSourceLabel(appointment.source),
    notes: appointment.notes,
    canConfirm: appointment.status === 'pending',
    canModify: ['pending', 'scheduled', 'confirmed'].includes(appointment.status),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const { id } = await params;

    const business = await prisma.business.findUnique({
      where: { id: authorized.session.businessId },
      select: {
        id: true,
        name: true,
        timezone: true,
        vapiPhoneNumber: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        businessId: business.id,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            smsConsent: true,
            smsOptedOut: true,
          },
        },
        service: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const updates = await request.json();
    const shouldResyncReminder =
      (typeof updates.status === 'string' && updates.status !== appointment.status) ||
      updates.startTime !== undefined ||
      updates.duration !== undefined ||
      updates.staffId !== undefined ||
      updates.serviceId !== undefined ||
      updates.serviceIds !== undefined;

    const blockedField = getBlockedFieldLabel([{ label: 'Notes', value: updates.notes }]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (updates.startTime || updates.duration) {
      const start = new Date(updates.startTime || appointment.startTime);
      const duration = updates.duration || appointment.duration;
      const end = new Date(start.getTime() + duration * 60000);

      const conflicts = await prisma.appointment.findMany({
        where: {
          businessId: business.id,
          id: { not: id },
          status: {
            in: ['pending', 'scheduled', 'confirmed'],
          },
          ...(updates.staffId && { staffId: updates.staffId }),
          OR: [
            {
              AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }],
            },
            {
              AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }],
            },
          ],
        },
      });

      if (conflicts.length > 0) {
        return NextResponse.json({ error: 'Time slot is not available' }, { status: 409 });
      }

      updates.endTime = end;
    }

    if (shouldResyncReminder) {
      updates.reminderSent = false;
    }

    const originalCanSendSms = canSendAppointmentSms(appointment.customer);
    if (
      shouldResyncReminder &&
      originalCanSendSms &&
      isReminderEligibleStatus(appointment.status)
    ) {
      const originalServiceName = await resolveServiceName(
        appointment.serviceIds,
        appointment.service?.name,
      );
      const appBase = getConfiguredAppBaseUrl();
      const appointmentUrl = appointment.shortId
        ? `${appBase}/a/${appointment.shortId}`
        : undefined;

      await cancelScheduledAppointmentReminder(appointment.customer.phone!, {
        customerName: appointment.customer.name,
        serviceName: originalServiceName,
        staffName: appointment.staff?.fullName || 'our team',
        dateTime: appointment.startTime,
        businessName: business.name,
        appointmentUrl,
        timezone: business.timezone ?? undefined,
        senderPhone: business.vapiPhoneNumber,
      });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: updates,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            smsConsent: true,
            smsOptedOut: true,
          },
        },
        service: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
      },
    });

    if (
      updates.status === 'confirmed' &&
      ['pending', 'scheduled'].includes(appointment.status) &&
      appointment.customer.phone &&
      appointment.customer.smsConsent &&
      !appointment.customer.smsOptedOut
    ) {
      const appBase = getConfiguredAppBaseUrl();
      const serviceName = await resolveServiceName(
        appointment.serviceIds,
        appointment.service?.name,
      );
      const appointmentUrl = appointment.shortId
        ? `${appBase}/a/${appointment.shortId}`
        : undefined;

      sendAppointmentBusinessConfirmed(appointment.customer.phone, {
        customerName: updatedAppointment.customer.name,
        serviceName,
        dateTime: appointment.startTime,
        businessName: business.name,
        appointmentUrl,
        timezone: business.timezone ?? undefined,
        senderPhone: business.vapiPhoneNumber,
      }).catch((error) => console.warn('Mobile confirmed SMS failed:', error));
    }

    if (updates.status === 'completed') {
      updateCustomerSegment(updatedAppointment.customerId).catch(console.error);
    }

    const updatedCanSendSms = canSendAppointmentSms(updatedAppointment.customer);
    const statusBecameReminderEligible =
      !isReminderEligibleStatus(appointment.status) &&
      isReminderEligibleStatus(updatedAppointment.status);
    const reminderDetailsChanged =
      shouldResyncReminder && isReminderEligibleStatus(appointment.status);

    if (
      updatedCanSendSms &&
      isReminderEligibleStatus(updatedAppointment.status) &&
      (statusBecameReminderEligible || reminderDetailsChanged)
    ) {
      const serviceName = await resolveServiceName(
        updatedAppointment.serviceIds,
        updatedAppointment.service?.name,
      );
      const shortId = await ensureAppointmentShortId(
        updatedAppointment.id,
        updatedAppointment.shortId,
      );
      const appBase = getConfiguredAppBaseUrl();
      const appointmentUrl = shortId ? `${appBase}/a/${shortId}` : undefined;
      const reminderResult = await scheduleAppointmentReminder(updatedAppointment.customer.phone!, {
        customerName: updatedAppointment.customer.name,
        serviceName,
        staffName: updatedAppointment.staff?.fullName || 'our team',
        dateTime: updatedAppointment.startTime,
        businessName: business.name,
        appointmentUrl,
        timezone: business.timezone ?? undefined,
        senderPhone: business.vapiPhoneNumber,
      });

      if (reminderResult.success) {
        await prisma.appointment.update({
          where: { id: updatedAppointment.id },
          data: { reminderSent: true },
        });
      }
    }

    const serviceName = await resolveServiceName(
      updatedAppointment.serviceIds,
      updatedAppointment.service?.name,
    );

    return NextResponse.json({
      appointment: toMobileAppointment(updatedAppointment, business.timezone, serviceName),
    });
  } catch (error) {
    console.error('PATCH /api/mobile/appointments/[id] error:', error);
    return NextResponse.json({ error: 'Unable to update mobile appointment' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const { id } = await params;

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        businessId: authorized.session.businessId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            smsConsent: true,
            smsOptedOut: true,
          },
        },
        service: { select: { name: true } },
        staff: { select: { fullName: true } },
        business: {
          select: {
            name: true,
            timezone: true,
            vapiPhoneNumber: true,
          },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (appointment.customer.phone && appointment.customer.smsConsent && !appointment.customer.smsOptedOut) {
      const serviceName = await resolveServiceName(
        appointment.serviceIds,
        appointment.service?.name,
      );
      const appBase = getConfiguredAppBaseUrl();
      const appointmentUrl = appointment.shortId
        ? `${appBase}/a/${appointment.shortId}`
        : undefined;

      await cancelScheduledAppointmentReminder(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName,
        staffName: appointment.staff?.fullName || 'our team',
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        appointmentUrl,
        timezone: appointment.business.timezone ?? undefined,
        senderPhone: appointment.business.vapiPhoneNumber,
      });

      await sendAppointmentCancellation(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName,
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        timezone: appointment.business.timezone ?? undefined,
        senderPhone: appointment.business.vapiPhoneNumber,
      });
    }

    await prisma.appointment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/mobile/appointments/[id] error:', error);
    return NextResponse.json({ error: 'Unable to cancel mobile appointment' }, { status: 500 });
  }
}
