import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const serviceId = searchParams.get('serviceId');
    const staffId = searchParams.get('staffId');

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Get business hours for the selected date
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();

    const businessHours = await prisma.businessHours.findUnique({
      where: {
        businessId_dayOfWeek: {
          businessId: business.id,
          dayOfWeek,
        },
      },
    });

    if (!businessHours || !businessHours.isOpen) {
      return NextResponse.json({ availableSlots: [] });
    }

    // Get service duration
    let duration = 60; // default 60 minutes
    if (serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });
      if (service) {
        duration = service.duration;
      }
    }

    // Get existing appointments for the date
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        businessId: business.id,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['scheduled', 'confirmed'],
        },
        ...(staffId && { staffId }),
      },
    });

    // Generate time slots
    const availableSlots = generateTimeSlots(
      businessHours.openTime!,
      businessHours.closeTime!,
      duration,
      existingAppointments,
      selectedDate
    );

    return NextResponse.json({ availableSlots });
  } catch (error: any) {
    console.error('Available slots error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch available slots' },
      { status: 500 }
    );
  }
}

function generateTimeSlots(
  openTime: string,
  closeTime: string,
  duration: number,
  existingAppointments: any[],
  date: Date
): string[] {
  const slots: string[] = [];
  
  // Parse times (format: "09:00")
  const [openHour, openMin] = openTime.split(':').map(Number);
  const [closeHour, closeMin] = closeTime.split(':').map(Number);

  let currentTime = new Date(date);
  currentTime.setHours(openHour, openMin, 0, 0);

  const endTime = new Date(date);
  endTime.setHours(closeHour, closeMin, 0, 0);

  while (currentTime < endTime) {
    const slotEnd = new Date(currentTime.getTime() + duration * 60000);

    if (slotEnd <= endTime) {
      // Check if slot conflicts with existing appointments
      const hasConflict = existingAppointments.some((apt) => {
        const aptStart = new Date(apt.startTime);
        const aptEnd = new Date(apt.endTime);
        
        return (
          (currentTime >= aptStart && currentTime < aptEnd) ||
          (slotEnd > aptStart && slotEnd <= aptEnd) ||
          (currentTime <= aptStart && slotEnd >= aptEnd)
        );
      });

      if (!hasConflict) {
        slots.push(formatTime(currentTime));
      }
    }

    // Move to next slot (30-minute intervals)
    currentTime = new Date(currentTime.getTime() + 30 * 60000);
  }

  return slots;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
