import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Convert a local business-timezone time to its correct UTC equivalent
function businessTimeToUTC(dateStr: string, hour: number, minute: number, timezone: string): Date {
  const localStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  const naiveUTC = new Date(localStr + 'Z');
  const inBizTz = new Date(naiveUTC.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = naiveUTC.getTime() - inBizTz.getTime();
  return new Date(naiveUTC.getTime() + offsetMs);
}

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
    const durationOverride = searchParams.get('duration');

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
    if (!business.businessHours) {
      console.log('No business hours configured');
      return NextResponse.json({ slots: [], message: 'Business hours not configured' });
    }

    const hoursData = business.businessHours.hours as any;
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

    // Get existing appointments for this day (in business timezone)
    const startOfDay = businessTimeToUTC(date, 0, 0, business.timezone);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);    // If a specific staff member is requested, check their working days
    if (staffId && staffId !== 'anyone') {
      const staffMember = await prisma.staff.findUnique({
        where: { id: staffId },
        select: { workDays: true },
      });
      if (staffMember && !staffMember.workDays.includes(dayOfWeek)) {
        return NextResponse.json({ slots: [], message: 'Staff member is not available on this day' });
      }
    }

    // Only load appointments for conflict checking when a specific staff member is requested
    const existingAppointments = (staffId && staffId !== 'anyone')
      ? await prisma.appointment.findMany({
          where: {
            businessId: business.id,
            staffId,
            status: {
              in: ['pending', 'scheduled', 'confirmed'],
            },
            startTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        })
      : [];

    console.log('Existing appointments:', existingAppointments.length);

    // Generate time slots
    const slots: string[] = [];
    const slotInterval = 30; // 30-minute intervals
    const duration = durationOverride ? parseInt(durationOverride) : service.duration;

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

        const slotTime = businessTimeToUTC(date, hour, minute, business.timezone);

        const slotEndTime = new Date(slotTime.getTime() + duration * 60000);

        // Check if slot end time exceeds business closing time
        const closeTime = businessTimeToUTC(date, closeHour, closeMinute, business.timezone);
        
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
