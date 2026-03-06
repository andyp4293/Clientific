import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSubscriptionInfo } from '@/lib/subscription';
import { APP_NAME } from '@/lib/brand';
import { UpgradePricingCards } from '@/components/billing/UpgradePricingCards';

export default async function SubscribePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/signin');

  const info = await getSubscriptionInfo(session.user.businessId);

  const status = info?.subscriptionStatus ?? 'trialing';
  const hasStripeCustomer = !!info?.stripeCustomerId;

  let headline = 'Subscription required';
  let subtext = `Choose a plan to continue using ${APP_NAME}.`;

  if (status === 'trialing' || status === 'trial') {
    headline = 'Your free trial has ended';
    subtext = 'Your 14-day trial is over. Choose a plan to keep your business running on ' + APP_NAME + '.';
  } else if (status === 'past_due') {
    headline = 'Payment failed';
    subtext = 'We couldn\'t process your last payment. Update your card to restore access.';
  } else if (status === 'canceled') {
    headline = 'Your subscription was canceled';
    subtext = `Reactivate a plan to get back into your ${APP_NAME} dashboard.`;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-start pt-12 px-4 pb-16">
      <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6">
        <span className="text-white font-bold text-3xl">C</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 text-center">{headline}</h1>
      <p className="mt-3 text-gray-500 dark:text-gray-400 text-center max-w-md">{subtext}</p>

      <UpgradePricingCards status={status} hasStripeCustomer={hasStripeCustomer} />
    </div>
  );
}
