import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

// PATCH - Update staff member
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;
    const body = await req.json();
    const { fullName, email, phone, role, bio, isActive, workDays } = body;

    const blockedField = getBlockedFieldLabel([
      { label: 'Staff name', value: fullName },
      { label: 'Role', value: role },
      { label: 'Bio', value: bio },
    ]);
    if (blockedField) {
      return NextResponse.json(
        { error: blockedContentError(blockedField) },
        { status: 400 }
      );
    }

    // Verify staff belongs to this business
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!existingStaff || existingStaff.businessId !== session.user.id) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }    const staff = await prisma.staff.update({
      where: { id },
      data: {
        fullName,
        email,
        phone,
        role,
        active: isActive,
        ...(Array.isArray(workDays) && { workDays }),
      },
    });

    // Map database 'active' field to frontend 'isActive'
    const staffWithIsActive = {
      ...staff,
      isActive: staff.active,
    };

    return NextResponse.json({ staff: staffWithIsActive });
  } catch (error: any) {
    console.error('Error updating staff:', error);
    return NextResponse.json(
      { error: 'Failed to update staff member' },
      { status: 500 }
    );
  }
}

// DELETE - Delete staff member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;

    // Verify staff belongs to this business
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!existingStaff || existingStaff.businessId !== session.user.id) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Check if staff has any appointments
    const appointmentCount = await prisma.appointment.count({
      where: {
        staffId: id,
        status: {
          in: ['scheduled', 'confirmed'],
        },
      },
    });

    if (appointmentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete staff member with scheduled appointments' },
        { status: 400 }
      );
    }

    await prisma.staff.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting staff:', error);
    return NextResponse.json(
      { error: 'Failed to delete staff member' },
      { status: 500 }
    );
  }
}
