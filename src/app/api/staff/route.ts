import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// GET - List all staff members for the business
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }    const staff = await prisma.staff.findMany({
      where: {
        businessId: session.user.id,
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    // Map database 'active' field to frontend 'isActive'
    const staffWithIsActive = staff.map(member => ({
      ...member,
      isActive: member.active,
    }));

    return NextResponse.json({ staff: staffWithIsActive });
  } catch (error: any) {
    console.error('Error fetching staff:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    );
  }
}

// POST - Create a new staff member
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fullName, email, phone, role, bio } = body;

    if (!fullName) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }    const staff = await prisma.staff.create({
      data: {
        businessId: session.user.id,
        fullName,
        email: email || null,
        phone: phone || null,
        role: role || null,
        active: true,
      },
    });

    return NextResponse.json({ staff }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating staff:', error);
    return NextResponse.json(
      { error: 'Failed to create staff member' },
      { status: 500 }
    );
  }
}
