import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get available time slots (public)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const serviceId = searchParams.get('serviceId');
    const staffId = searchParams.get('staffId');

    if (!date || !serviceId) {
      return NextResponse.json(
        { error: 'Date and service are required' },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        businessHours: true,
      },
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

    // Get service details for duration
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { duration: true },
    });

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Get day of week (0 = Sunday, 6 = Saturday)
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();

    // Get business hours for this day
    const hours = business.businessHours.find(h => h.dayOfWeek === dayOfWeek);

    if (!hours || !hours.isOpen) {
      return NextResponse.json({ slots: [] });
    }

    // Parse business hours
    const [openHour, openMinute] = hours.openTime!.split(':').map(Number);
    const [closeHour, closeMinute] = hours.closeTime!.split(':').map(Number);

    // Get existing appointments for this day
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        businessId: business.id,
        status: {
          in: ['scheduled', 'confirmed'],
        },
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        ...(staffId && staffId !== 'anyone' && { staffId }),
      },
    });

    // Generate time slots
    const slots: string[] = [];
    const slotInterval = 30; // 30-minute intervals
    const duration = service.duration;

    for (let hour = openHour; hour < closeHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        // Skip if we're at closing time or would go past closing
        if (hour === closeHour && minute >= closeMinute) break;
        if (hour === closeHour - 1 && minute + duration > 60 && closeMinute === 0) break;

        const slotTime = new Date(selectedDate);
        slotTime.setHours(hour, minute, 0, 0);

        const slotEndTime = new Date(slotTime.getTime() + duration * 60000);

        // Check if slot end time exceeds business closing time
        const closeTime = new Date(selectedDate);
        closeTime.setHours(closeHour, closeMinute, 0, 0);
        
        if (slotEndTime > closeTime) continue;

        // Check if slot is in the past
        if (slotTime < new Date()) continue;

        // Check if slot conflicts with existing appointments
        const hasConflict = existingAppointments.some(apt => {
          const aptStart = new Date(apt.startTime);
          const aptEnd = new Date(apt.endTime);
          
          return (
            (slotTime >= aptStart && slotTime < aptEnd) ||
            (slotEndTime > aptStart && slotEndTime <= aptEnd) ||
            (slotTime <= aptStart && slotEndTime >= aptEnd)
          );
        });

        if (!hasConflict) {
          slots.push(slotTime.toISOString());
        }
      }
    }

    return NextResponse.json({ slots });
  } catch (error: any) {
    console.error('Fetch available slots error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch available slots' },
      { status: 500 }
    );
  }
}
