'use client';

import { signOut } from 'next-auth/react';
import { useEffect } from 'react';

export default function SignOutPage() {
  useEffect(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  return (
    <div className="brand-shell min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-100">Signing out...</p>
      </div>
    </div>
  );
}
