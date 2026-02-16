import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Twilio SMS Webhook Handler for STOP/HELP keywords
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    
    const from = params.get('From'); // Customer phone number
    const messageBody = params.get('Body')?.trim().toUpperCase();
    
    if (!from || !messageBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Handle STOP keyword
    if (messageBody === 'STOP' || messageBody === 'UNSUBSCRIBE') {
      await prisma.customer.updateMany({
        where: { phone: from },
        data: {
          smsOptedOut: true,
          smsOptedOutAt: new Date(),
        },
      });

      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from SMS notifications. Reply START to opt back in.</Message></Response>',
        {
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    // Handle START keyword
    if (messageBody === 'START' || messageBody === 'SUBSCRIBE') {
      await prisma.customer.updateMany({
        where: { phone: from },
        data: {
          smsOptedOut: false,
          smsOptedOutAt: null,
        },
      });

      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been re-subscribed to SMS notifications. Reply STOP to opt out.</Message></Response>',
        {
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    // Handle HELP keyword
    if (messageBody === 'HELP' || messageBody === 'INFO') {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>ClientFlow Appointment Notifications. Reply STOP to unsubscribe, START to resubscribe. For support, contact your salon.</Message></Response>',
        {
          headers: { 'Content-Type': 'text/xml' },
        }
      );
    }

    // Default response for other messages
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  } catch (error) {
    console.error('Twilio webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
