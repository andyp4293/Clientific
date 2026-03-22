import { redirect } from 'next/navigation';

type SetupRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildRedirectUrl(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) query.append(key, item);
      });
      return;
    }

    if (value) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `/dashboard/payouts?${queryString}` : '/dashboard/payouts';
}

export default async function PayoutsSetupPage({ searchParams }: SetupRedirectPageProps) {
  const params = (await searchParams) ?? {};
  redirect(buildRedirectUrl(params));
}
