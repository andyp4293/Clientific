import { NextResponse } from 'next/server';
import https from 'https';

export async function GET() {
  const result: Record<string, any> = {};

  // Test raw HTTPS to api.stripe.com (bypasses Stripe SDK entirely)
  try {
    const data = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.stripe.com',
          path: '/v1/balance',
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            'Stripe-Version': '2024-12-18.acacia',
          },
          timeout: 10000,
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: body.slice(0, 300) }));
        }
      );
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('timeout')));
      req.end();
    });
    result.raw = data;
  } catch (e: any) {
    result.rawError = { message: e.message, code: e.code };
  }

  // Test via Stripe SDK
  try {
    const { stripe } = await import('@/lib/stripe');
    const balance = await stripe.balance.retrieve();
    result.sdk = { ok: true, livemode: balance.livemode };
  } catch (e: any) {
    result.sdkError = { message: e.message, type: e.type, code: e.code };
  }

  return NextResponse.json(result);
}
