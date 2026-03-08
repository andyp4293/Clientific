import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const limitParam = parseInt(searchParams.get('limit') || '24', 10);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 24 : limitParam), 48);

    const now = new Date();

    const deals = await prisma.deal.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
        business: {
          enableOnlineBooking: true,
          ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
          ...(category && category !== 'all' ? { businessType: category } : {}),
        },
      },
      include: {
        business: {
          select: {
            name: true,
            businessType: true,
            city: true,
            slug: true,
            publicId: true,
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    // Remove maxed-out deals
    const available = deals.filter(
      d => d.maxRedemptions === null || d.redemptionCount < d.maxRedemptions
    );

    return NextResponse.json({
      deals: available.map(d => ({
        id: d.id,
        title: d.title,
        discountType: d.discountType,
        discountValue: d.discountValue,
        expiresAt: d.expiresAt,
        business: d.business,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/public/explore/deals error:', error);
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}
