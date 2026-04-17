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
      mode: 'web',
    });

    return NextResponse.json(response);
  } catch (error: any) {
    if (error instanceof RegisterBusinessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Registration error:', error);

    let errorMessage = 'Unable to create account. Please try again later.';
    let statusCode = 500;

    if (
      error.message?.includes("Can't reach database") ||
      error.code === 'P1001' ||
      error.code === 'ECONNREFUSED'
    ) {
      errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
    } else if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
      errorMessage = 'An account with this email already exists.';
      statusCode = 400;
    } else if (error.code === 'P2011' || error.message?.includes('required')) {
      errorMessage = 'Please provide all required information.';
      statusCode = 400;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
