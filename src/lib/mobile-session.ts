import { SignJWT, jwtVerify } from 'jose';

const MOBILE_SESSION_AUDIENCE = 'clientific-mobile';
const MOBILE_SESSION_ISSUER = 'clientific.app';
const MOBILE_SESSION_TYPE = 'mobile-session';

export type MobileSessionPayload = {
  businessId: string;
  email: string;
  name: string;
  onboardingComplete: boolean;
};

function getMobileSessionSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required for mobile session tokens');
  }

  return new TextEncoder().encode(secret);
}

export async function createMobileSessionToken(
  payload: MobileSessionPayload,
) {
  return new SignJWT({
    businessId: payload.businessId,
    email: payload.email,
    name: payload.name,
    onboardingComplete: payload.onboardingComplete,
    type: MOBILE_SESSION_TYPE,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.businessId)
    .setIssuer(MOBILE_SESSION_ISSUER)
    .setAudience(MOBILE_SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getMobileSessionSecret());
}

export async function verifyMobileSessionToken(token: string) {
  const { payload } = await jwtVerify(token, getMobileSessionSecret(), {
    issuer: MOBILE_SESSION_ISSUER,
    audience: MOBILE_SESSION_AUDIENCE,
  });

  if (payload.type !== MOBILE_SESSION_TYPE || typeof payload.businessId !== 'string') {
    throw new Error('Invalid mobile session token');
  }

  return {
    businessId: payload.businessId,
    email: typeof payload.email === 'string' ? payload.email : '',
    name: typeof payload.name === 'string' ? payload.name : '',
    onboardingComplete: Boolean(payload.onboardingComplete),
  };
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}
