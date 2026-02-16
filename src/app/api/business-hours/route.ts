import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// GET - Get business hours
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }    const businessHours = await prisma.businessHours.findUnique({
      where: {
        businessId: session.user.id,
      },
    });

    // Convert JSON structure to array format for the frontend
    if (businessHours) {
      const hoursArray = Object.keys(businessHours.hours as any).map((day) => {
        const dayHours = (businessHours.hours as any)[day];
        return {
          dayOfWeek: parseInt(day),
          isOpen: dayHours.isOpen || false,
          openTime: dayHours.openTime || null,
          closeTime: dayHours.closeTime || null,
        };
      }).sort((a, b) => a.dayOfWeek - b.dayOfWeek);

      return NextResponse.json({ businessHours: hoursArray });
    }

    // Return default hours if none exist
    const defaultHours = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      isOpen: i >= 1 && i <= 5,
      openTime: i >= 1 && i <= 5 ? '09:00' : null,
      closeTime: i >= 1 && i <= 5 ? '17:00' : null,
    }));

    return NextResponse.json({ businessHours: defaultHours });
  } catch (error: any) {
    console.error('Error fetching business hours:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business hours' },
      { status: 500 }
    );
  }
}

// PATCH - Update business hours (batch update)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }    const body = await req.json();
    const { hours } = body; // Array of business hours

    if (!Array.isArray(hours)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }

    // Convert array format to JSON structure
    const hoursJson: any = {};
    hours.forEach((hour: any) => {
      hoursJson[hour.dayOfWeek.toString()] = {
        isOpen: hour.isOpen,
        openTime: hour.openTime,
        closeTime: hour.closeTime,
      };
    });

    // Upsert the business hours
    await prisma.businessHours.upsert({
      where: {
        businessId: session.user.id,
      },
      update: {
        hours: hoursJson,
      },
      create: {
        businessId: session.user.id,
        hours: hoursJson,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating business hours:', error);
    return NextResponse.json(
      { error: 'Failed to update business hours' },
      { status: 500 }
    );
  }
}
