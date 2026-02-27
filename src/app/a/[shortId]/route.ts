import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { shortId },
    select: { id: true },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://clientflow-theta.vercel.app';

  if (!appointment) {
    return NextResponse.redirect(`${base}/`);
  }

  return NextResponse.redirect(`${base}/appt/${appointment.id}`);
}
