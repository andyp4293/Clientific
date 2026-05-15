import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      businessId: string;
      onboardingComplete: boolean;
      accountType: 'owner' | 'staff';
      staffId?: string;
      staffName?: string;
      staffPasswordChangeRequired?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    businessId: string;
    onboardingComplete: boolean;
    accountType?: 'owner' | 'staff';
    staffId?: string;
    staffName?: string;
    passwordChangeRequired?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    businessId: string;
    onboardingComplete: boolean;
    accountType?: 'owner' | 'staff';
    staffId?: string;
    staffName?: string;
    staffPasswordChangeRequired?: boolean;
  }
}
