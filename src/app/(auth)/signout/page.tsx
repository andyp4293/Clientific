import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SignOutPage() {
  redirect('/api/auth/force-signout?callbackUrl=/login');
}
