import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import {
  authenticateBusinessCredentials,
  BusinessAuthError,
} from '@/lib/business-auth';
import {
  authenticateStaffCredentials,
  StaffAuthError,
} from '@/lib/staff-auth';
import { getStaffSessionAccess } from '@/lib/staff-session-access';

const ONBOARDING_SELECT = {
  id: true,
  phone: true,
  street: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
} as const;

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const input = {
        email: credentials?.email,
        password: credentials?.password,
      };

      try {
        const business = await authenticateBusinessCredentials(input);
        return {
          ...business,
          accountType: 'owner' as const,
        };
      } catch (businessError) {
        if (
          businessError instanceof BusinessAuthError &&
          !['INVALID_CREDENTIALS', 'MISSING_CREDENTIALS'].includes(businessError.code)
        ) {
          throw businessError;
        }

        try {
          return await authenticateStaffCredentials(input);
        } catch (staffError) {
          if (
            staffError instanceof StaffAuthError &&
            staffError.code === 'SERVICE_UNAVAILABLE'
          ) {
            throw staffError;
          }

          throw businessError;
        }
      }
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') {
        return true;
      }

      const email = user.email?.toLowerCase();
      const googleEmailVerified = Boolean((profile as { email_verified?: boolean } | undefined)?.email_verified);
      if (!email || !googleEmailVerified) {
        return '/login?error=GoogleEmailNotVerified';
      }

      const business = await prisma.business.findUnique({
        where: { email },
        select: { id: true, emailVerifiedAt: true },
      });
      if (!business) {
        return `/register?email=${encodeURIComponent(email)}&oauth=google`;
      }
      if (!business.emailVerifiedAt) {
        return '/login?error=EmailNotVerified';
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const businessId = (user as { businessId?: string }).businessId;
        const onboardingComplete = (user as { onboardingComplete?: boolean }).onboardingComplete;
        const accountType = (user as { accountType?: 'owner' | 'staff' }).accountType ?? 'owner';
        const staffId = (user as { staffId?: string }).staffId;
        const staffName = (user as { staffName?: string }).staffName;
        const passwordChangeRequired = (user as { passwordChangeRequired?: boolean })
          .passwordChangeRequired;
        if (businessId) {
          token.businessId = businessId;
        }
        if (typeof onboardingComplete === 'boolean') {
          token.onboardingComplete = onboardingComplete;
        }
        token.accountType = accountType;
        token.staffId = staffId;
        token.staffName = staffName;
        token.staffPasswordChangeRequired =
          accountType === 'staff' ? Boolean(passwordChangeRequired) : false;
      }

      if (token.accountType === 'staff') {
        const access = await getStaffSessionAccess({
          staffId: typeof token.staffId === 'string' ? token.staffId : null,
          businessId: typeof token.businessId === 'string' ? token.businessId : null,
        });
        if (!access.allowed) {
          token.staffPortalAccessRevoked = true;
          token.staffPasswordChangeRequired = false;
          return token;
        }
        token.staffPortalAccessRevoked = false;
        token.staffPasswordChangeRequired = access.passwordChangeRequired;
        token.staffName = access.staffName;
        return token;
      }

      if (!token.businessId || !token.id || typeof token.onboardingComplete !== 'boolean') {
        const business =
          token.businessId
            ? await prisma.business.findUnique({
                where: { id: token.businessId as string },
                select: ONBOARDING_SELECT,
              })
            : token.email
              ? await prisma.business.findUnique({
                  where: { email: token.email.toLowerCase() },
                  select: ONBOARDING_SELECT,
                })
              : null;

        if (business) {
          token.id = business.id;
          token.businessId = business.id;
          token.onboardingComplete = isBusinessOnboardingComplete(business);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) {
          session.user.id = token.id as string;
        }
        if (token.businessId) {
          session.user.businessId = token.businessId as string;
        }
        session.user.onboardingComplete = Boolean(token.onboardingComplete);
        session.user.accountType = token.accountType === 'staff' ? 'staff' : 'owner';
        session.user.staffId = typeof token.staffId === 'string' ? token.staffId : undefined;
        session.user.staffName =
          typeof token.staffName === 'string' ? token.staffName : undefined;
        session.user.staffPasswordChangeRequired =
          token.accountType === 'staff' ? Boolean(token.staffPasswordChangeRequired) : false;
        session.user.staffPortalAccessRevoked =
          token.accountType === 'staff' ? Boolean(token.staffPortalAccessRevoked) : false;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
