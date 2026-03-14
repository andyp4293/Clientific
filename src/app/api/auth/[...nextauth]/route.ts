import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/utils';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';

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
    },      async authorize(credentials) {
      try {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter your email and password');
        }

        const business = await prisma.business.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!business) {
          throw new Error('Email or password is incorrect');
        }

        const isValid = await verifyPassword(credentials.password, business.passwordHash);

        if (!isValid) {
          throw new Error('Email or password is incorrect');
        }

        if (!business.emailVerifiedAt) {
          throw new Error('EmailNotVerified');
        }

        return {
          id: business.id,
          email: business.email,
          name: business.name,
          businessId: business.id,
          onboardingComplete: isBusinessOnboardingComplete(business),
        };
      } catch (error: any) {
        // Log the actual error for debugging (server-side only)
        console.error('Auth error:', error);
        
        // Don't expose database connection errors to users
        if (error.message.includes('prisma') || error.message.includes('database')) {
          throw new Error('Service temporarily unavailable');
        }
        
        // Re-throw user-friendly errors
        throw error;
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
        if (businessId) {
          token.businessId = businessId;
        }
        if (typeof onboardingComplete === 'boolean') {
          token.onboardingComplete = onboardingComplete;
        }
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
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
