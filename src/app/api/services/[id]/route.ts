import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// PATCH /api/services/[id] - Update a service
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, duration, price, isActive } = body;

    // Validation
    if (name !== undefined && !name.trim()) {
      return NextResponse.json(
        { error: 'Service name cannot be empty' },
        { status: 400 }
      );
    }

    if (duration !== undefined && duration < 5) {
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
    }

    // Verify service belongs to this business
    const existingService = await prisma.service.findFirst({
      where: {
        id,
        businessId: business.id,
      },
    });

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }    // Update service
    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(duration !== undefined && { duration: parseInt(duration) }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null }),
        ...(isActive !== undefined && { active: isActive }),
      },
    });

    // Map 'active' to 'isActive' for frontend compatibility
    const serviceWithIsActive = {
      ...service,
      isActive: service.active,
    };

    return NextResponse.json({ service: serviceWithIsActive });
  } catch (error) {
    console.error('Failed to update service:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

// DELETE /api/services/[id] - Delete a service
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get user's business
    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Verify service belongs to this business
    const existingService = await prisma.service.findFirst({
      where: {
        id,
        businessId: business.id,
      },
    });

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Check if service has any appointments
    const appointmentCount = await prisma.appointment.count({
      where: { serviceId: id },
    });

    if (appointmentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete service with existing appointments. Consider deactivating it instead.' },
        { status: 400 }
      );
    }

    // Delete service
    await prisma.service.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}
