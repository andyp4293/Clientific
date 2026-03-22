import { NextResponse } from 'next/server';
import { normalizeEmail, isValidEmail } from '@/lib/auth-verification';
import { sendSupportContactEmail } from '@/lib/email';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { APP_SUPPORT_EMAIL } from '@/lib/brand';

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  let body: any;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    const name = readText(body?.name);
    const emailInput = readText(body?.email);
    const email = emailInput ? normalizeEmail(emailInput) : '';
    const company = readText(body?.company);
    const subject = readText(body?.subject);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const website = readText(body?.website);

    if (website) {
      return NextResponse.json({ success: true });
    }

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Name must be 100 characters or fewer.' },
        { status: 400 }
      );
    }

    if (company.length > 120) {
      return NextResponse.json(
        { error: 'Company must be 120 characters or fewer.' },
        { status: 400 }
      );
    }

    if (subject.length > 140) {
      return NextResponse.json(
        { error: 'Subject must be 140 characters or fewer.' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or fewer.' },
        { status: 400 }
      );
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Name', value: name },
      { label: 'Company', value: company },
      { label: 'Subject', value: subject },
      { label: 'Message', value: message },
    ]);

    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    await sendSupportContactEmail({
      name,
      email,
      company: company || null,
      subject: subject || null,
      message,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Support contact submission failed:', error);
    return NextResponse.json(
      {
        error: `We could not send your message right now. Please email ${APP_SUPPORT_EMAIL} directly.`,
      },
      { status: 500 }
    );
  }
}
