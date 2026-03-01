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
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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
    }    // Get service details for duration
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { duration: true },
    });

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }    // Parse date in local timezone
    const [year, month, day] = date.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const dayOfWeek = selectedDate.getDay();    // Get business hours for this day from JSON structure
    if (!business.businessHours) {
      console.log('❌ No business hours found for business:', business.id);
      return NextResponse.json({ slots: [], message: 'Business hours not configured' });
    }

    const businessHoursRecord = business.businessHours;
    const hoursData = businessHoursRecord.hours as any;
    const hours = hoursData[dayOfWeek.toString()];

    console.log('📅 Selected date:', date, 'Day of week:', dayOfWeek);
    console.log('🕐 Full hours data:', JSON.stringify(hoursData, null, 2));
    console.log('🕐 Hours for day', dayOfWeek, ':', JSON.stringify(hours, null, 2));    if (!hours || !hours.isOpen) {
      console.log('❌ Business is closed on this day. Hours:', JSON.stringify(hours, null, 2));
      return NextResponse.json({ slots: [], message: 'Business is closed on this day' });
    }    // Parse business hours
    const [openHour, openMinute] = hours.openTime!.split(':').map(Number);
    const [closeHour, closeMinute] = hours.closeTime!.split(':').map(Number);

    console.log('✅ Business hours:', { openHour, openMinute, closeHour, closeMinute });

    // Get existing appointments for this day (in business timezone)
    const startOfDay = businessTimeToUTC(date, 0, 0, business.timezone);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    console.log('🔍 Checking appointments between:', startOfDay.toISOString(), 'and', endOfDay.toISOString());

    // If a specific staff member is requested, check their working days
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
      : [];    console.log('📋 Existing appointments:', existingAppointments.length);

    // Generate time slots
    const slots: string[] = [];
    const slotInterval = 30; // 30-minute intervals
    const duration = durationOverride ? parseInt(durationOverride) : service.duration;

    console.log('📍 Service duration:', duration, 'minutes');
    console.log('⏰ Generating slots with', slotInterval, 'min intervals for', duration, 'min service');

    for (let hour = openHour; hour < closeHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        // Skip if we're at closing time or would go past closing
        if (hour === closeHour && minute >= closeMinute) break;
        if (hour === closeHour - 1 && minute + duration > 60 && closeMinute === 0) break;

        const slotTime = businessTimeToUTC(date, hour, minute, business.timezone);

        const slotEndTime = new Date(slotTime.getTime() + duration * 60000);

        // Check if slot end time exceeds business closing time
        const closeTime = businessTimeToUTC(date, closeHour, closeMinute, business.timezone);
        
        if (slotEndTime > closeTime) {
          console.log('⏭️  Skipping slot', slotTime.toLocaleTimeString(), '- would exceed closing time');
          continue;
        }

        // Check if slot is in the past
        if (slotTime < new Date()) {
          console.log('⏭️  Skipping slot', slotTime.toLocaleTimeString(), '- in the past');
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
        });        if (!hasConflict) {
          console.log('✅ Adding slot:', slotTime.toLocaleTimeString());
          slots.push(slotTime.toISOString());
        } else {
          console.log('⏭️  Skipping slot', slotTime.toLocaleTimeString(), '- conflict with existing appointment');
        }
      }
    }

    console.log('🎯 Generated', slots.length, 'available slots');

    return NextResponse.json({ slots });
  } catch (error: any) {
    console.error('Fetch available slots error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch available slots' },
      { status: 500 }
    );
  }
}
