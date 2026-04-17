import { NextResponse } from 'next/server';
import {
  registerBusinessAccount,
  RegisterBusinessError,
} from '@/lib/business-registration';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await registerBusinessAccount({
      input: body,
      mode: 'mobile',
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof RegisterBusinessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('POST /api/mobile/auth/register error:', error);
    return NextResponse.json(
      { error: 'Unable to create your mobile account right now' },
      { status: 500 },
    );
  }
}
