import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingBusiness = await prisma.business.findUnique({
      where: { email: email.toLowerCase() },
    });

    return NextResponse.json({
      available: !existingBusiness,
      email: email.toLowerCase(),
    });
  } catch (error: any) {
    console.error('Check email error:', error);
    return NextResponse.json(
      { error: 'Failed to check email availability' },
      { status: 500 }
    );
  }
}
