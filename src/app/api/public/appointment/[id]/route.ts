import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendAppointmentCancellation } from '@/lib/twilio';

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
      service: { select: { name: true, price: true } },
      staff: { select: { fullName: true } },
      business: {
        select: {
          name: true,
          phone: true,
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

  // Resolve services array from serviceIds (fall back to single service)
  let services: { name: string; price: number | null }[] = [];
  if (appointment.serviceIds.length > 0) {
    services = await prisma.service.findMany({
      where: { id: { in: appointment.serviceIds } },
      select: { name: true, price: true },
    });
  } else if (appointment.service) {
    services = [appointment.service];
  }
  const totalPrice = services.reduce((sum, s) => sum + (s.price ?? 0), 0);

  return NextResponse.json({ appointment: { ...appointment, services, totalPrice } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await req.json();

  if (status !== 'cancelled') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: {
      status: true,
      startTime: true,
      service: { select: { name: true } },
      customer: { select: { name: true, phone: true } },
      business: { select: { name: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  if (existing.status === 'cancelled') {
    return NextResponse.json({ error: 'Appointment already cancelled' }, { status: 409 });
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  // Send cancellation SMS to customer
  if (existing.customer.phone) {
    sendAppointmentCancellation(existing.customer.phone, {
      customerName: existing.customer.name,
      serviceName: existing.service?.name || 'Appointment',
      dateTime: existing.startTime,
      businessName: existing.business.name,
    }).catch((err) => console.warn('⚠️  Cancellation SMS failed:', err));
  }

  return NextResponse.json({ appointment });
}
