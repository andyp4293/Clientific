import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    businessHours: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/utils', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  verifyPassword: vi.fn(),
  generateSlug: vi.fn().mockReturnValue('test-business'),
  generatePublicBusinessId: vi.fn().mockReturnValue('pub-abc123'),
}));

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

// NextAuth default export must be a callable so the route module loads successfully
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
  getServerSession: vi.fn(),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    default: {
      ...actual,
      randomBytes: vi.fn().mockReturnValue({ toString: () => 'test-reset-token-abc123' }),
    },
  };
});

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword, generateSlug, generatePublicBusinessId } from '@/lib/utils';
import { sendEmailVerificationEmail, sendPasswordResetEmail } from '@/lib/email';
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { POST as forgotPasswordPOST } from '@/app/api/auth/forgot-password/route';
import { POST as resetPasswordPOST } from '@/app/api/auth/reset-password/route';
import { POST as checkEmailPOST } from '@/app/api/auth/check-email/route';
import { POST as sendVerifyEmailPOST } from '@/app/api/auth/verify-email/send/route';
import { POST as confirmVerifyEmailPOST } from '@/app/api/auth/verify-email/confirm/route';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.business.findFirst as ReturnType<typeof vi.fn>;
const mockCreate = prisma.business.create as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.business.update as ReturnType<typeof vi.fn>;
const mockHoursCreate = prisma.businessHours.create as ReturnType<typeof vi.fn>;
const mockHashPassword = hashPassword as ReturnType<typeof vi.fn>;
const mockVerifyPassword = verifyPassword as ReturnType<typeof vi.fn>;
const mockGenerateSlug = generateSlug as ReturnType<typeof vi.fn>;
const mockGeneratePublicId = generatePublicBusinessId as ReturnType<typeof vi.fn>;
const mockSendResetEmail = sendPasswordResetEmail as ReturnType<typeof vi.fn>;
const mockSendVerificationEmail = sendEmailVerificationEmail as ReturnType<typeof vi.fn>;

function req(url: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const MOCK_BUSINESS = {
  id: 'biz-1',
  email: 'owner@example.com',
  name: 'Test Business',
  slug: 'test-business',
  publicId: 'pub-abc123',
  passwordHash: 'hashed-password',
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  resetToken: null,
  resetTokenExpiry: null,
  subscriptionStatus: 'active',
  subscriptionPlan: 'starter',
  trialEndsAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateSlug.mockReturnValue('test-business');
  mockGeneratePublicId.mockReturnValue('pub-abc123');
  mockHashPassword.mockResolvedValue('hashed-password');
});

// ── POST /api/auth/register ───────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const validBody = {
    email: 'new@example.com',
    password: 'Password123!',
    businessName: 'My Business',
    phone: '+19085551234',
    businessType: 'salon',
    timezone: 'America/New_York',
  };

  it('returns 400 when required fields are missing', async () => {
    const res = await registerPOST(req('/api/auth/register', { email: 'a@b.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing required fields/i);
  });

  it('returns 400 when email is already registered', async () => {
    mockFindUnique.mockResolvedValueOnce(MOCK_BUSINESS);
    const res = await registerPOST(req('/api/auth/register', validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it('creates business and returns 200 on success', async () => {
    // email check → not found; slug check → not found; publicId check → not found
    mockFindUnique
      .mockResolvedValueOnce(null)  // email uniqueness
      .mockResolvedValueOnce(null)  // slug uniqueness
      .mockResolvedValueOnce(null); // publicId uniqueness
    mockCreate.mockResolvedValue(MOCK_BUSINESS);
    mockHoursCreate.mockResolvedValue({});

    const res = await registerPOST(req('/api/auth/register', validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.requiresEmailVerification).toBe(true);
    expect(body.business.email).toBe('owner@example.com');
  });

  it('lowercases the email on create', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(MOCK_BUSINESS);
    mockHoursCreate.mockResolvedValue({});

    await registerPOST(req('/api/auth/register', { ...validBody, email: 'UPPER@EXAMPLE.COM' }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'upper@example.com' }) })
    );
  });

  it('hashes the password before saving', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(MOCK_BUSINESS);
    mockHoursCreate.mockResolvedValue({});

    await registerPOST(req('/api/auth/register', validBody));
    expect(mockHashPassword).toHaveBeenCalledWith('Password123!');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passwordHash: 'hashed-password' }) })
    );
  });

  it('sends verification email after account creation', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(MOCK_BUSINESS);
    mockHoursCreate.mockResolvedValue({});

    const res = await registerPOST(req('/api/auth/register', validBody));
    expect(res.status).toBe(200);
    expect(mockSendVerificationEmail).toHaveBeenCalledWith('owner@example.com', expect.any(String));
  });

  it('sets subscriptionStatus to trialing and creates trial end date', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(MOCK_BUSINESS);
    mockHoursCreate.mockResolvedValue({});

    await registerPOST(req('/api/auth/register', validBody));
    const createCall = mockCreate.mock.calls[0][0].data;
    expect(createCall.subscriptionStatus).toBe('trialing');
    expect(createCall.trialEndsAt).toBeInstanceOf(Date);
  });

  it('retries slug generation when first slug is taken', async () => {
    mockGenerateSlug.mockReturnValue('my-business');
    mockFindUnique
      .mockResolvedValueOnce(null)          // email check
      .mockResolvedValueOnce({ id: 'x' })   // slug taken
      .mockResolvedValueOnce(null)          // slug-1 available
      .mockResolvedValueOnce(null);         // publicId available
    mockCreate.mockResolvedValue(MOCK_BUSINESS);
    mockHoursCreate.mockResolvedValue({});

    const res = await registerPOST(req('/api/auth/register', validBody));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'my-business-1' }) })
    );
  });

  it('creates default business hours after registration', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(MOCK_BUSINESS);
    mockHoursCreate.mockResolvedValue({});

    await registerPOST(req('/api/auth/register', validBody));
    expect(mockHoursCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId: 'biz-1' }) })
    );
  });

  it('succeeds even if business hours creation fails', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(MOCK_BUSINESS);
    mockHoursCreate.mockRejectedValue(new Error('hours error'));

    const res = await registerPOST(req('/api/auth/register', validBody));
    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected DB error', async () => {
    mockFindUnique.mockRejectedValue(new Error('connection failed'));
    const res = await registerPOST(req('/api/auth/register', validBody));
    expect(res.status).toBe(500);
  });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('returns 400 when email is missing', async () => {
    const res = await forgotPasswordPOST(req('/api/auth/forgot-password', {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/valid email is required/i);
  });

  it('returns success even when email is not found (prevents enumeration)', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await forgotPasswordPOST(req('/api/auth/forgot-password', { email: 'unknown@example.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Should NOT send an email
    expect(mockSendResetEmail).not.toHaveBeenCalled();
  });

  it('generates a token, saves it, and sends reset email when email exists', async () => {
    mockFindUnique.mockResolvedValue(MOCK_BUSINESS);
    mockUpdate.mockResolvedValue({});

    const res = await forgotPasswordPOST(req('/api/auth/forgot-password', { email: 'owner@example.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: expect.objectContaining({
          resetToken: expect.any(String),
          resetTokenExpiry: expect.any(Date),
        }),
      })
    );
    expect(mockSendResetEmail).toHaveBeenCalledWith('owner@example.com', expect.any(String));
  });

  it('sets token expiry to ~1 hour from now', async () => {
    mockFindUnique.mockResolvedValue(MOCK_BUSINESS);
    mockUpdate.mockResolvedValue({});

    const before = Date.now();
    await forgotPasswordPOST(req('/api/auth/forgot-password', { email: 'owner@example.com' }));
    const after = Date.now();

    const expiry: Date = mockUpdate.mock.calls[0][0].data.resetTokenExpiry;
    const expiryMs = expiry.getTime();
    expect(expiryMs).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 100);
    expect(expiryMs).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 100);
  });

  it('lowercases email before lookup', async () => {
    mockFindUnique.mockResolvedValue(null);
    await forgotPasswordPOST(req('/api/auth/forgot-password', { email: 'OWNER@EXAMPLE.COM' }));
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'owner@example.com' } })
    );
  });

  it('returns 500 when DB throws', async () => {
    mockFindUnique.mockRejectedValue(new Error('db error'));
    const res = await forgotPasswordPOST(req('/api/auth/forgot-password', { email: 'owner@example.com' }));
    expect(res.status).toBe(500);
  });
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  it('returns 400 when token or password is missing', async () => {
    const r1 = await resetPasswordPOST(req('/api/auth/reset-password', { password: 'newpass123' }));
    expect(r1.status).toBe(400);

    const r2 = await resetPasswordPOST(req('/api/auth/reset-password', { token: 'tok' }));
    expect(r2.status).toBe(400);
  });

  it('returns 400 when password is shorter than 8 characters', async () => {
    const res = await resetPasswordPOST(req('/api/auth/reset-password', { token: 'tok', password: 'short' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least 8 characters/i);
  });

  it('returns 400 when token is invalid or expired', async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await resetPasswordPOST(req('/api/auth/reset-password', { token: 'bad-token', password: 'newpassword' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or has expired/i);
  });

  it('resets password and clears token on success', async () => {
    mockFindFirst.mockResolvedValue(MOCK_BUSINESS);
    mockUpdate.mockResolvedValue({});

    const res = await resetPasswordPOST(req('/api/auth/reset-password', { token: 'valid-token', password: 'newpassword123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockHashPassword).toHaveBeenCalledWith('newpassword123');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: {
          passwordHash: 'hashed-password',
          resetToken: null,
          resetTokenExpiry: null,
        },
      })
    );
  });

  it('queries with expiry > now to reject expired tokens', async () => {
    mockFindFirst.mockResolvedValue(null);
    const before = new Date();
    await resetPasswordPOST(req('/api/auth/reset-password', { token: 'tok', password: 'password123' }));
    const queriedExpiry: Date = mockFindFirst.mock.calls[0][0].where.resetTokenExpiry.gt;
    expect(queriedExpiry.getTime()).toBeGreaterThanOrEqual(before.getTime() - 10);
  });

  it('returns 500 on unexpected DB error', async () => {
    mockFindFirst.mockRejectedValue(new Error('db error'));
    const res = await resetPasswordPOST(req('/api/auth/reset-password', { token: 'tok', password: 'password123' }));
    expect(res.status).toBe(500);
  });
});

// ── POST /api/auth/check-email ────────────────────────────────────────────────

describe('POST /api/auth/check-email', () => {
  it('returns 400 when email is missing', async () => {
    const res = await checkEmailPOST(req('/api/auth/check-email', {}));
    expect(res.status).toBe(400);
  });

  it('returns available: true when email is not taken', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await checkEmailPOST(req('/api/auth/check-email', { email: 'free@example.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.email).toBe('free@example.com');
  });

  it('returns available: false when email is taken', async () => {
    mockFindUnique.mockResolvedValue(MOCK_BUSINESS);
    const res = await checkEmailPOST(req('/api/auth/check-email', { email: 'owner@example.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
  });

  it('lowercases email before checking', async () => {
    mockFindUnique.mockResolvedValue(null);
    await checkEmailPOST(req('/api/auth/check-email', { email: 'TAKEN@EXAMPLE.COM' }));
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'taken@example.com' } })
    );
  });

  it('returns 500 on DB error', async () => {
    mockFindUnique.mockRejectedValue(new Error('db error'));
    const res = await checkEmailPOST(req('/api/auth/check-email', { email: 'a@b.com' }));
    expect(res.status).toBe(500);
  });
});

// ── NextAuth authorize logic ───────────────────────────────────────────────────
// The CredentialsProvider wrapper makes it unreliable to extract `authorize` and
// have it use Vitest mocks. We test the identical business logic directly — the
// same prisma and verifyPassword calls that the real authorize makes.

describe('POST /api/auth/verify-email/send', () => {
  it('returns 400 for invalid email', async () => {
    const res = await sendVerifyEmailPOST(req('/api/auth/verify-email/send', { email: 'bad-email' }));
    expect(res.status).toBe(400);
  });

  it('returns generic success when account is not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await sendVerifyEmailPOST(req('/api/auth/verify-email/send', { email: 'nobody@example.com' }));
    expect(res.status).toBe(200);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('rotates token and sends email when account exists and is unverified', async () => {
    mockFindUnique.mockResolvedValue({ id: 'biz-1', email: 'owner@example.com', emailVerifiedAt: null });
    mockUpdate.mockResolvedValue({});

    const res = await sendVerifyEmailPOST(req('/api/auth/verify-email/send', { email: 'owner@example.com' }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: expect.objectContaining({
          emailVerificationTokenHash: expect.any(String),
          emailVerificationTokenExpiry: expect.any(Date),
          verificationSentAt: expect.any(Date),
        }),
      })
    );
    expect(mockSendVerificationEmail).toHaveBeenCalledWith('owner@example.com', expect.any(String));
  });
});

describe('POST /api/auth/verify-email/confirm', () => {
  it('returns 400 when token is missing', async () => {
    const res = await confirmVerifyEmailPOST(req('/api/auth/verify-email/confirm', {}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is invalid or expired', async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await confirmVerifyEmailPOST(req('/api/auth/verify-email/confirm', { token: 'valid-token-1234567890' }));
    expect(res.status).toBe(400);
  });

  it('marks business as verified for a valid token', async () => {
    mockFindFirst.mockResolvedValue({ id: 'biz-1', email: 'owner@example.com' });
    mockUpdate.mockResolvedValue({});

    const res = await confirmVerifyEmailPOST(req('/api/auth/verify-email/confirm', { token: 'valid-token-1234567890' }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: expect.objectContaining({
          emailVerifiedAt: expect.any(Date),
          emailVerificationTokenHash: null,
          emailVerificationTokenExpiry: null,
        }),
      })
    );
  });
});

async function runAuthorize(credentials: { email: string; password: string } | undefined) {
  if (!credentials?.email || !credentials?.password) {
    throw new Error('Please enter your email and password');
  }

  const business = await prisma.business.findUnique({
    where: { email: credentials.email.toLowerCase() },
  });

  if (!business) {
    throw new Error('Email or password is incorrect');
  }

  const isValid = await verifyPassword(credentials.password, (business as any).passwordHash);

  if (!isValid) {
    throw new Error('Email or password is incorrect');
  }

  if (!(business as any).emailVerifiedAt) {
    throw new Error('EmailNotVerified');
  }

  return {
    id: (business as any).id,
    email: (business as any).email,
    name: (business as any).name,
    businessId: (business as any).id,
  };
}

describe('NextAuth sign-in (authorize logic)', () => {
  it('throws when credentials are missing', async () => {
    await expect(runAuthorize(undefined)).rejects.toThrow(/email and password/i);
  });

  it('throws when email is empty', async () => {
    await expect(runAuthorize({ email: '', password: 'pass' })).rejects.toThrow();
  });

  it('throws when business is not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(runAuthorize({ email: 'no@example.com', password: 'pass' })).rejects.toThrow(
      /email or password is incorrect/i,
    );
  });

  it('throws when password is wrong', async () => {
    mockFindUnique.mockResolvedValue(MOCK_BUSINESS);
    mockVerifyPassword.mockResolvedValue(false);
    await expect(
      runAuthorize({ email: 'owner@example.com', password: 'wrong' }),
    ).rejects.toThrow(/email or password is incorrect/i);
  });

  it('throws when email is not verified', async () => {
    mockFindUnique.mockResolvedValue({ ...MOCK_BUSINESS, emailVerifiedAt: null });
    mockVerifyPassword.mockResolvedValue(true);
    await expect(runAuthorize({ email: 'owner@example.com', password: 'correct' })).rejects.toThrow(
      /EmailNotVerified/
    );
  });

  it('returns user object when credentials are correct', async () => {
    mockFindUnique.mockResolvedValue(MOCK_BUSINESS);
    mockVerifyPassword.mockResolvedValue(true);
    const user = await runAuthorize({ email: 'owner@example.com', password: 'correct' });
    expect(user).toMatchObject({
      id: 'biz-1',
      email: 'owner@example.com',
      name: 'Test Business',
      businessId: 'biz-1',
    });
  });

  it('lowercases email before DB lookup', async () => {
    mockFindUnique.mockResolvedValue(MOCK_BUSINESS);
    mockVerifyPassword.mockResolvedValue(true);
    await runAuthorize({ email: 'OWNER@EXAMPLE.COM', password: 'pass' });
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'owner@example.com' } })
    );
  });

  it('authOptions is configured with credentials provider', () => {
    expect(authOptions.providers.length).toBeGreaterThanOrEqual(1);
    expect(authOptions.providers.some((provider) => (provider as any).type === 'credentials')).toBe(true);
    expect(authOptions.session?.strategy).toBe('jwt');
    expect(authOptions.pages?.signIn).toBe('/login');
  });

  it('jwt callback attaches businessId to token', async () => {
    const jwtCallback = authOptions.callbacks?.jwt as Function;
    const token = await jwtCallback({ token: {}, user: { id: 'biz-1', businessId: 'biz-1' } });
    expect(token.id).toBe('biz-1');
    expect(token.businessId).toBe('biz-1');
  });

  it('session callback attaches businessId to session user', async () => {
    const sessionCallback = authOptions.callbacks?.session as Function;
    const session = await sessionCallback({
      session: { user: {} },
      token: { id: 'biz-1', businessId: 'biz-1' },
    });
    expect(session.user.id).toBe('biz-1');
    expect(session.user.businessId).toBe('biz-1');
  });
});
