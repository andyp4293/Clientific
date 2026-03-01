import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendAppointmentReminder } from '@/lib/twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      reminderSent: false,
      status: { in: ['pending', 'scheduled', 'confirmed'] },
      startTime: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      startTime: true,
      customer: { select: { name: true, phone: true, smsConsent: true, smsOptedOut: true } },
      service: { select: { name: true } },
      staff: { select: { fullName: true } },
      business: { select: { name: true, timezone: true } },
      serviceIds: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  await Promise.all(
    appointments.map(async (appt) => {
      const phone = appt.customer.phone;
      if (!phone || !appt.customer.smsConsent || appt.customer.smsOptedOut) {
        skipped++;
        return;
      }

      // Resolve service name (multi-service fallback)
      let serviceName = appt.service?.name ?? 'Appointment';
      if (appt.serviceIds.length > 1) {
        const services = await prisma.service.findMany({
          where: { id: { in: appt.serviceIds } },
          select: { name: true },
        });
        serviceName = services.map((s) => s.name).join(', ');
      }

      const result = await sendAppointmentReminder(phone, {
        customerName: appt.customer.name,
        serviceName,
        staffName: appt.staff?.fullName ?? 'our team',
        dateTime: appt.startTime,
        businessName: appt.business.name,
      });

      if (result.success) {
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSent: true },
        });
        sent++;
      } else {
        console.warn(`⚠️ Reminder failed for appointment ${appt.id}:`, result.error);
        failed++;
      }
    })
  );

  console.log(`📱 Reminders: ${sent} sent, ${skipped} skipped, ${failed} failed`);
  return NextResponse.json({ sent, skipped, failed });
}
