import { NextResponse } from 'next/server';
import {
  authenticateBusinessCredentials,
  BusinessAuthError,
} from '@/lib/business-auth';
import { createMobileSessionToken } from '@/lib/mobile-session';

export async function POST(request: Request) {
  let body: { email?: string; password?: string } | null = null;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const business = await authenticateBusinessCredentials({
      email: body?.email,
      password: body?.password,
    });

    const token = await createMobileSessionToken({
      businessId: business.businessId,
      email: business.email,
      name: business.name,
      onboardingComplete: business.onboardingComplete,
    });

    return NextResponse.json({
      token,
      business: {
        id: business.businessId,
        email: business.email,
        name: business.name,
        onboardingComplete: business.onboardingComplete,
      },
    });
  } catch (error) {
    if (error instanceof BusinessAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('POST /api/mobile/auth/login error:', error);
    return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 500 });
  }
}
