import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendAppointmentConfirmation } from '@/lib/twilio';

// POST - Create public booking (no auth required)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;

    const business = await prisma.business.findUnique({
      where: { publicId },
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
      serviceIds: rawServiceIds,
      serviceId: rawServiceId,
      staffId,
      startTime,
      duration,
      customerName,
      customerPhone,
      customerEmail,
      notes,
      smsConsent,
    } = await req.json();

    // Support both serviceIds[] (new) and serviceId (legacy)
    const serviceIds: string[] = rawServiceIds?.length
      ? rawServiceIds
      : rawServiceId
        ? [rawServiceId]
        : [];

    // Validation
    if (!serviceIds.length || !startTime || !duration || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: 'Service, start time, duration, name, and phone are required' },
        { status: 400 }
      );
    }

    // Verify all services belong to this business
    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        businessId: business.id,
      },
    });

    if (services.length !== serviceIds.length) {
      return NextResponse.json(
        { error: 'One or more services not found' },
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

    // Check for conflicts — only when a specific staff member is requested
    if (staffId && staffId !== 'anyone') {
      const conflicts = await prisma.appointment.findMany({
        where: {
          businessId: business.id,
          staffId,
          status: {
            in: ['pending', 'scheduled', 'confirmed'],
          },
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
          smsConsent: smsConsent || false,
        },
      });
    } else {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: customerName,
          ...(customerEmail && { email: customerEmail }),
          ...(smsConsent && !customer.smsOptedOut && { smsConsent: true }),
        },
      });
    }

    // Generate a short ID for the SMS link
    const shortId = Math.random().toString(36).substring(2, 9).toUpperCase();

    // Create appointment with pending status (business must confirm)
    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        serviceId: serviceIds[0],
        serviceIds,
        staffId: staffId && staffId !== 'anyone' ? staffId : null,
        startTime: start,
        endTime: end,
        duration,
        notes: notes || null,
        status: 'pending',
        shortId,
      },
      include: {
        customer: true,
        service: true,
        staff: true,
        business: {
          select: {
            name: true,
          },
        },
      },
    });

    // Send SMS confirmation only if customer consented
    const appBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://clientflow-theta.vercel.app').trim().replace(/\/$/, '');
    const appointmentUrl = `${appBase}/a/${shortId}`;
    const serviceName = services.map(s => s.name).join(', ');
    let smsResult = null;
    if (customer.phone && smsConsent) {
      smsResult = await sendAppointmentConfirmation(customer.phone, {
        customerName: customer.name,
        serviceName,
        staffName: appointment.staff?.fullName || 'our team',
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        duration: appointment.duration,
        appointmentUrl,
      });

      if (smsResult.success) {
        console.log('✅ SMS confirmation sent to:', customer.phone);
      } else {
        console.warn('⚠️  SMS failed:', smsResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      appointment,
      message: 'Appointment request submitted! The business will confirm shortly.',
      smsNotification: smsResult?.success
        ? 'Confirmation SMS sent'
        : customer.phone
          ? 'SMS notification failed'
          : 'No phone number provided',
      smsDebug: {
        attempted: !!(customer.phone && smsConsent),
        consentGiven: !!smsConsent,
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
