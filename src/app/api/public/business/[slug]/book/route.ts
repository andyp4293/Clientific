import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Create public booking (no auth required)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, enableOnlineBooking: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    if (!business.enableOnlineBooking) {
      return NextResponse.json(
        { error: 'Online booking is not enabled' },
        { status: 403 }
      );
    }

    const {
      serviceId,
      staffId,
      startTime,
      duration,
      customerName,
      customerPhone,
      customerEmail,
      notes,
    } = await req.json();

    // Validation
    if (!serviceId || !startTime || !duration || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: 'Service, start time, duration, name, and phone are required' },
        { status: 400 }
      );
    }

    // Verify service belongs to this business
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        businessId: business.id,
      },
    });

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Verify staff belongs to this business (if provided)
    if (staffId && staffId !== 'anyone') {
      const staff = await prisma.staff.findFirst({
        where: {
          id: staffId,
          businessId: business.id,
        },
      });

      if (!staff) {
        return NextResponse.json(
          { error: 'Staff member not found' },
          { status: 404 }
        );
      }
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);

    // Check for conflicts
    const conflicts = await prisma.appointment.findMany({
      where: {
        businessId: business.id,
        status: {
          in: ['scheduled', 'confirmed'],
        },
        ...(staffId && staffId !== 'anyone' && { staffId }),
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
          {
            AND: [
              { startTime: { gte: start } },
              { endTime: { lte: end } },
            ],
          },
        ],
      },
    });

    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: 'Time slot is no longer available' },
        { status: 409 }
      );
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        businessId: business.id,
        phone: customerPhone,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId: business.id,
          name: customerName,
          phone: customerPhone,
          email: customerEmail || null,
        },
      });
    } else {
      // Update customer info if provided
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: customerName,
          ...(customerEmail && { email: customerEmail }),
        },
      });
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        serviceId,
        staffId: staffId && staffId !== 'anyone' ? staffId : null,
        startTime: start,
        endTime: end,
        duration,
        notes: notes || null,
        status: 'scheduled',
      },
      include: {
        customer: true,
        service: true,
        staff: true,
      },
    });

    return NextResponse.json({ 
      success: true,
      appointment,
      message: 'Appointment booked successfully!' 
    });
  } catch (error: any) {
    console.error('Create booking error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}
