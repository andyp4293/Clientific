import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get available time slots (public)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const serviceId = searchParams.get('serviceId');
    const staffId = searchParams.get('staffId');

    if (!date || !serviceId) {
      return NextResponse.json(
        { error: 'Date and service are required' },
        { status: 400 }
      );
    }    const business = await prisma.business.findUnique({
      where: { publicId },
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

    // Parse date in local timezone (YYYY-MM-DD format)
    const [year, month, day] = date.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const dayOfWeek = selectedDate.getDay();    console.log('=== AVAILABLE SLOTS DEBUG ===');
    console.log('Selected date input:', date);
    console.log('Parsed date:', selectedDate);
    console.log('Day of week:', dayOfWeek);
    console.log('Business hours:', JSON.stringify(business.businessHours, null, 2));

    // Get business hours for this day from JSON structure
    if (!business.businessHours || business.businessHours.length === 0) {
      console.log('No business hours configured');
      return NextResponse.json({ slots: [], message: 'Business hours not configured' });
    }

    const businessHoursRecord = business.businessHours[0];
    const hoursData = businessHoursRecord.hours as any;
    const hours = hoursData[dayOfWeek.toString()];

    console.log('Hours for day:', hours);

    if (!hours || !hours.isOpen) {
      console.log('No hours found or not open for this day');
      return NextResponse.json({ slots: [], message: 'Business is closed on this day' });
    }
    const [openHour, openMinute] = hours.openTime!.split(':').map(Number);
    const [closeHour, closeMinute] = hours.closeTime!.split(':').map(Number);

    console.log('Open time:', openHour, ':', openMinute);
    console.log('Close time:', closeHour, ':', closeMinute);
    console.log('Service duration:', service.duration, 'minutes');

    // Get existing appointments for this day
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);    const existingAppointments = await prisma.appointment.findMany({
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

    console.log('Existing appointments:', existingAppointments.length);

    // Generate time slots
    const slots: string[] = [];
    const slotInterval = 30; // 30-minute intervals
    const duration = service.duration;

    let totalSlotsGenerated = 0;
    let slotsPastFiltered = 0;
    let slotsConflictFiltered = 0;
    let slotsTimeFiltered = 0;    for (let hour = openHour; hour < closeHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        totalSlotsGenerated++;
        
        // Skip if we're at closing time or would go past closing
        if (hour === closeHour && minute >= closeMinute) {
          slotsTimeFiltered++;
          break;
        }
        if (hour === closeHour - 1 && minute + duration > 60 && closeMinute === 0) {
          slotsTimeFiltered++;
          break;
        }

        const slotTime = new Date(selectedDate);
        slotTime.setHours(hour, minute, 0, 0);

        const slotEndTime = new Date(slotTime.getTime() + duration * 60000);

        // Check if slot end time exceeds business closing time
        const closeTime = new Date(selectedDate);
        closeTime.setHours(closeHour, closeMinute, 0, 0);
        
        if (slotEndTime > closeTime) {
          slotsTimeFiltered++;
          continue;
        }

        // Check if slot is in the past
        if (slotTime < new Date()) {
          slotsPastFiltered++;
          continue;
        }

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
        } else {
          slotsConflictFiltered++;
        }
      }
    }

    console.log('Total slots generated:', totalSlotsGenerated);
    console.log('Slots filtered (time constraints):', slotsTimeFiltered);
    console.log('Slots filtered (in past):', slotsPastFiltered);
    console.log('Slots filtered (conflicts):', slotsConflictFiltered);
    console.log('Available slots:', slots.length);
    console.log('=== END DEBUG ===');

    return NextResponse.json({ slots });
  } catch (error: any) {
    console.error('Fetch available slots error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch available slots' },
      { status: 500 }
    );
  }
}
