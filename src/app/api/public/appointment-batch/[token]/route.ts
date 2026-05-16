import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';
import { parseAppointmentBatchToken } from '@/lib/appointment-confirmation-batches';
import { buildAiAppointmentBatchWhereInput } from '@/lib/ai-appointment-batches';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = parseAppointmentBatchToken(token);

  if (!payload) {
    return NextResponse.json({ error: 'Appointment batch not found' }, { status: 404 });
  }

  const appointmentWhere =
    payload.t === 'online'
      ? {
          businessId: payload.b,
          id: { in: payload.a },
        }
      : buildAiAppointmentBatchWhereInput(payload.b, payload.p, payload.s, payload.e);

  const appointments = await prisma.appointment.findMany({
    where: appointmentWhere,
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      duration: true,
      notes: true,
      serviceIds: true,
      staffId: true,
      customer: {
        select: {
          name: true,
        },
      },
      service: { select: { name: true, price: true } },
      staff: { select: { fullName: true } },
      business: {
        select: {
          id: true,
          name: true,
          phone: true,
          timezone: true,
          slug: true,
          publicId: true,
        },
      },
    },
    orderBy: { startTime: 'asc' },
    take: 20,
  });

  if (appointments.length === 0) {
    return NextResponse.json({ error: 'Appointment batch not found' }, { status: 404 });
  }

  const serviceIds = [...new Set(appointments.flatMap((appointment) => appointment.serviceIds))];
  const servicesById = new Map(
    (
      serviceIds.length > 0
        ? await prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true, price: true },
          })
        : []
    ).map((service) => [service.id, service])
  );

  const session = await getServerSession(authOptions);
  const sessionBusinessId = getSessionBusinessId(session);
  const { id: businessId, ...publicBusiness } = appointments[0].business;

  return NextResponse.json({
    batch: {
      business: publicBusiness,
      customerName: appointments[0].customer.name,
      appointments: appointments.map((appointment) => {
        const services =
          appointment.serviceIds.length > 0
            ? appointment.serviceIds
                .map((serviceId) => servicesById.get(serviceId))
                .filter((service): service is { id: string; name: string; price: number | null } =>
                  Boolean(service)
                )
            : appointment.service
              ? [{ id: 'single', name: appointment.service.name, price: appointment.service.price }]
              : [];

        return {
          ...appointment,
          business: publicBusiness,
          services,
          totalPrice: services.reduce((sum, service) => sum + (service.price ?? 0), 0),
        };
      }),
    },
    viewerCanManage: sessionBusinessId === businessId,
  });
}
