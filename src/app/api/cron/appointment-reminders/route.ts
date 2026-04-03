import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { scheduleAppointmentReminder } from '@/lib/appointment-reminders';
import { ensureAppointmentShortId } from '@/lib/appointment-short-id';
import {
  collectAppointmentServiceIds,
  resolveAppointmentServiceDisplayName,
} from '@/lib/appointment-services';

const APPOINTMENT_REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;
const TWILIO_MIN_SCHEDULE_LEAD_MS = 15 * 60 * 1000;
const TWILIO_MAX_SCHEDULE_WINDOW_MS = 35 * 24 * 60 * 60 * 1000;

function authorizeCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authError = authorizeCronRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const now = new Date();
    const earliestStart = new Date(
      now.getTime() + APPOINTMENT_REMINDER_LEAD_MS + TWILIO_MIN_SCHEDULE_LEAD_MS,
    );
    const latestStart = new Date(
      now.getTime() + APPOINTMENT_REMINDER_LEAD_MS + TWILIO_MAX_SCHEDULE_WINDOW_MS,
    );

    const appointments = await prisma.appointment.findMany({
      where: {
        reminderSent: false,
        status: { in: ['scheduled', 'confirmed'] },
        startTime: {
          gte: earliestStart,
          lte: latestStart,
        },
        customer: {
          is: {
            phone: { not: null },
            smsConsent: true,
            smsOptedOut: false,
          },
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
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
      orderBy: {
        startTime: 'asc',
      },
      take: 500,
    });

    const serviceIds = collectAppointmentServiceIds(appointments);
    const services = serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true },
        })
      : [];

    const appBase = getConfiguredAppBaseUrl();
    let scheduledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const appointment of appointments) {
      try {
        const serviceName =
          resolveAppointmentServiceDisplayName(appointment, services) ??
          appointment.service?.name ??
          'Appointment';
        const shortId = await ensureAppointmentShortId(appointment.id, appointment.shortId);
        const appointmentUrl = shortId ? `${appBase}/a/${shortId}` : undefined;
        const result = await scheduleAppointmentReminder(
          appointment.customer.phone!,
          {
            customerName: appointment.customer.name,
            serviceName,
            staffName: appointment.staff?.fullName || 'our team',
            dateTime: appointment.startTime,
            businessName: appointment.business.name,
            appointmentUrl,
            timezone: appointment.business.timezone ?? undefined,
            senderPhone: appointment.business.vapiPhoneNumber,
          },
          now,
        );

        if (result.success) {
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: { reminderSent: true },
          });
          scheduledCount += 1;
          continue;
        }

        if (result.error === 'Appointment is outside the reminder scheduling window') {
          skippedCount += 1;
          continue;
        }

        failedCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error('Failed to backfill appointment reminder:', appointment.id, error);
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      scheduledCount,
      skippedCount,
      failedCount,
      scannedCount: appointments.length,
    });
  } catch (error) {
    console.error('GET /api/cron/appointment-reminders error:', error);
    return NextResponse.json(
      { error: 'Appointment reminder maintenance failed' },
      { status: 500 },
    );
  }
}
