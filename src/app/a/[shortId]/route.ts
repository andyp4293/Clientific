import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { parseAppointmentBatchToken } from '@/lib/appointment-confirmation-batches';
import { buildAiAppointmentBatchWhereInput } from '@/lib/ai-appointment-batches';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { shortId },
    select: { id: true },
  });

  const base = getConfiguredAppBaseUrl();

  if (appointment) {
    return NextResponse.redirect(`${base}/appt/${appointment.id}`);
  }

  const batchPayload = parseAppointmentBatchToken(shortId);
  if (!batchPayload) {
    return NextResponse.redirect(`${base}/`);
  }

  if (batchPayload.t === 'online') {
    const batchAppointments = await prisma.appointment.findMany({
      where: {
        businessId: batchPayload.b,
        id: { in: batchPayload.a },
      },
      select: { id: true },
      orderBy: { startTime: 'asc' },
      take: 20,
    });

    if (batchAppointments.length === 0) {
      return NextResponse.redirect(`${base}/`);
    }

    if (batchAppointments.length === 1) {
      return NextResponse.redirect(`${base}/appt/${batchAppointments[0].id}`);
    }

    return NextResponse.redirect(`${base}/appt/batch/${encodeURIComponent(shortId)}`);
  }

  const batchAppointments = await prisma.appointment.findMany({
    where: buildAiAppointmentBatchWhereInput(
      batchPayload.b,
      batchPayload.p,
      batchPayload.s,
      batchPayload.e
    ),
    select: { id: true },
    orderBy: { startTime: 'asc' },
    take: 10,
  });

  if (batchAppointments.length === 0) {
    return NextResponse.redirect(`${base}/`);
  }

  if (batchAppointments.length === 1) {
    return NextResponse.redirect(`${base}/appt/${batchAppointments[0].id}`);
  }

  return NextResponse.redirect(`${base}/appt/batch/${encodeURIComponent(shortId)}`);
}
