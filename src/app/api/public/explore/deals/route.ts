import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawLocation = searchParams.get('location')?.trim() || searchParams.get('city')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const limitParam = parseInt(searchParams.get('limit') || '24', 10);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 24 : limitParam), 48);

    const normalizedLocation = rawLocation.split(',')[0].trim();
    const zipMatch = rawLocation.match(/\b\d{5}(?:-\d{4})?\b/);
    const zipNeedle = zipMatch?.[0] ?? '';

    const locationFilters: Array<Record<string, unknown>> = [];
    if (normalizedLocation) {
      locationFilters.push({ city: { contains: normalizedLocation, mode: 'insensitive' } });
      locationFilters.push({ state: { contains: normalizedLocation, mode: 'insensitive' } });
      locationFilters.push({ zipCode: { contains: normalizedLocation, mode: 'insensitive' } });
    }

    if (zipNeedle && zipNeedle !== normalizedLocation) {
      locationFilters.push({ zipCode: { contains: zipNeedle, mode: 'insensitive' } });
    }

    const now = new Date();

    const deals = await prisma.deal.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
        business: {
          enableOnlineBooking: true,
          ...(locationFilters.length > 0 ? { OR: locationFilters } : {}),
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
