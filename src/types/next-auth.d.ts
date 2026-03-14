import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      businessId: string;
      onboardingComplete: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    businessId: string;
    onboardingComplete: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    businessId: string;
    onboardingComplete: boolean;
  }
}
