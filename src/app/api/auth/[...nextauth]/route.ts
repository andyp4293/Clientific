import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/utils';

export const authOptions: NextAuthOptions = {
  providers: [
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

          return {
            id: business.id,
            email: business.email,
            name: business.name,
            businessId: business.id,
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
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.businessId = user.businessId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.businessId = token.businessId as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
