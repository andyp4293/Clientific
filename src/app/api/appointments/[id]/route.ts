import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { sendAppointmentCancellation } from '@/lib/twilio';

// GET - Get single appointment
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { id } = await params;

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: id,
        businessId: business.id,
      },
      include: {
        customer: true,
        service: true,
        staff: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    return NextResponse.json({ appointment });
  } catch (error: any) {
    console.error('Fetch appointment error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch appointment' },
      { status: 500 }
    );
  }
}

// PATCH - Update appointment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { id } = await params;

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: id,
        businessId: business.id,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const updates = await req.json();

    // If updating time, check for conflicts
    if (updates.startTime || updates.duration) {
      const start = new Date(updates.startTime || appointment.startTime);
      const duration = updates.duration || appointment.duration;
      const end = new Date(start.getTime() + duration * 60000);      const conflicts = await prisma.appointment.findMany({
        where: {
          businessId: business.id,
          id: { not: id },
          status: {
            in: ['scheduled', 'confirmed'],
          },
          ...(updates.staffId && { staffId: updates.staffId }),
          OR: [
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
          ],
        },
      });

      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: 'Time slot is not available' },
          { status: 409 }
        );
      }

      updates.endTime = end;
    }    const updatedAppointment = await prisma.appointment.update({
      where: { id: id },
      data: updates,
      include: {
        customer: true,
        service: true,
        staff: true,
      },
    });

    return NextResponse.json({ appointment: updatedAppointment });
  } catch (error: any) {
    console.error('Update appointment error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update appointment' },
      { status: 500 }
    );
  }
}

// DELETE - Delete appointment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }    const { id } = await params;

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: id,
        businessId: business.id,
      },
      include: {
        customer: true,
        service: true,
        business: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Send cancellation SMS
    if (appointment.customer.phone) {
      await sendAppointmentCancellation(appointment.customer.phone, {
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name || 'Appointment',
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
      });
    }

    await prisma.appointment.delete({
      where: { id: id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete appointment error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete appointment' },
      { status: 500 }
    );
  }
}
