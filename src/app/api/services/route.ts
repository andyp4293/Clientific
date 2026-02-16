import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET /api/services - Get all services for the business
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    // Get user's business
    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }    // Fetch all services for this business
    const services = await prisma.service.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
    });

    // Map 'active' to 'isActive' for frontend compatibility
    const servicesWithIsActive = services.map(service => ({
      ...service,
      isActive: service.active,
    }));

    return NextResponse.json({ services: servicesWithIsActive });
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

// POST /api/services - Create a new service
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, duration, price, isActive } = body;

    // Validation
    if (!name || !duration) {
      return NextResponse.json(
        { error: 'Name and duration are required' },
        { status: 400 }
      );
    }

    if (duration < 5) {
      return NextResponse.json(
        { error: 'Duration must be at least 5 minutes' },
        { status: 400 }
      );
    }    // Get user's business
    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }    // Create service
    const service = await prisma.service.create({
      data: {
        businessId: business.id,
        name: name.trim(),
        description: description?.trim() || null,
        duration: parseInt(duration),
        price: price ? parseFloat(price) : null,
        active: isActive !== undefined ? isActive : true,
      },
    });

    // Map 'active' to 'isActive' for frontend compatibility
    const serviceWithIsActive = {
      ...service,
      isActive: service.active,
    };

    return NextResponse.json({ service: serviceWithIsActive }, { status: 201 });
  } catch (error) {
    console.error('Failed to create service:', error);
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
}
