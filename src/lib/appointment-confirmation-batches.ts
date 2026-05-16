import crypto from 'crypto';

export type AiAppointmentBatchTokenPayload = {
  v: 1;
  t: 'ai';
  b: string;
  p: string;
  s: number;
  e: number;
};

export type OnlineAppointmentBatchTokenPayload = {
  v: 1;
  t: 'online';
  b: string;
  a: string[];
};

export type AppointmentBatchTokenPayload =
  | AiAppointmentBatchTokenPayload
  | OnlineAppointmentBatchTokenPayload;

function getAppointmentBatchTokenSecret(): string {
  return (
    process.env.APPOINTMENT_BATCH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.VAPI_WEBHOOK_SECRET ||
    process.env.TWILIO_AUTH_TOKEN ||
    'clientific-appointment-batch-dev-secret'
  );
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getAppointmentBatchTokenSecret())
    .update(encodedPayload)
    .digest('base64url');
}

function isValidPayload(value: unknown): value is AppointmentBatchTokenPayload {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Record<string, unknown>;
  if (
    payload.v === 1 &&
    payload.t === 'ai' &&
    typeof payload.b === 'string' &&
    payload.b.length > 0 &&
    typeof payload.p === 'string' &&
    payload.p.length > 0 &&
    typeof payload.s === 'number' &&
    Number.isFinite(payload.s) &&
    typeof payload.e === 'number' &&
    Number.isFinite(payload.e) &&
    payload.e >= payload.s
  ) {
    return true;
  }

  return (
    payload.v === 1 &&
    payload.t === 'online' &&
    typeof payload.b === 'string' &&
    payload.b.length > 0 &&
    Array.isArray(payload.a) &&
    payload.a.length > 0 &&
    payload.a.length <= 20 &&
    payload.a.every((appointmentId) => typeof appointmentId === 'string' && appointmentId.length > 0)
  );
}

export function createAppointmentBatchToken(
  payload: Omit<AiAppointmentBatchTokenPayload, 'v' | 't'>
): string {
  const normalizedPayload: AiAppointmentBatchTokenPayload = {
    v: 1,
    t: 'ai',
    ...payload,
  };
  const encodedPayload = Buffer.from(JSON.stringify(normalizedPayload)).toString('base64url');
  const signature = signPayload(encodedPayload);

  return `ab1.${encodedPayload}.${signature}`;
}

export function createOnlineAppointmentBatchToken(
  payload: Omit<OnlineAppointmentBatchTokenPayload, 'v' | 't'>
): string {
  const normalizedPayload: OnlineAppointmentBatchTokenPayload = {
    v: 1,
    t: 'online',
    ...payload,
  };
  const encodedPayload = Buffer.from(JSON.stringify(normalizedPayload)).toString('base64url');
  const signature = signPayload(encodedPayload);

  return `ab1.${encodedPayload}.${signature}`;
}

export function parseAppointmentBatchToken(
  token: string | null | undefined
): AppointmentBatchTokenPayload | null {
  if (typeof token !== 'string' || token.trim().length === 0) return null;

  const [version, encodedPayload, signature] = token.split('.');
  if (version !== 'ab1' || !encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return isValidPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}
