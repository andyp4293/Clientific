import { NextResponse } from 'next/server';
import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    await prisma.notification.updateMany({
      where: {
        businessId: authorized.session.businessId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/mobile/notifications/read error:', error);
    return NextResponse.json(
      { error: 'Unable to mark notifications as read' },
      { status: 500 },
    );
  }
}
