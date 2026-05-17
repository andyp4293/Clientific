import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ClientificLogo } from '@/components/brand/ClientificLogo';
import { APP_NAME } from '@/lib/brand';
import { getStaffSessionAccess } from '@/lib/staff-session-access';
import { StaffSetPasswordForm } from './StaffSetPasswordForm';

export default async function StaffSetPasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }
  if (session.user.accountType !== 'staff' || !session.user.staffId) {
    redirect('/dashboard');
  }
  const access = await getStaffSessionAccess({
    staffId: session.user.staffId,
    businessId: session.user.businessId,
  });
  if (!access.allowed) {
    redirect('/signout');
  }
  if (!session.user.staffPasswordChangeRequired) {
    redirect('/staff/appointments');
  }

  return (
    <main className="page-shell flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl rounded-[2rem] border border-gray-200 bg-white p-6 shadow-xl shadow-emerald-950/10 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/30 sm:p-8">
        <div className="mb-8">
          <ClientificLogo />
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.22em] text-primary">
            First sign-in
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-950 dark:text-white">
            Create your employee password
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Use the temporary password from your email once, then choose your own
            password before opening your appointment view.
          </p>
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-gray-700 dark:border-primary/30 dark:bg-primary/10 dark:text-gray-200">
            Signed in as <span className="font-bold">{session.user.email}</span> for{' '}
            <span className="font-bold">{APP_NAME}</span>.
          </div>
        </div>

        <StaffSetPasswordForm email={session.user.email ?? ''} />
      </section>
    </main>
  );
}
