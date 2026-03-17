import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { APP_URL } from '@/lib/brand';
import CustomerViewPage from './CustomerViewPage';

export const metadata = { title: 'Customer View' };

export default async function PreviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const business = await prisma.business.findUnique({
    where: { id: session.user.id },
    select: {
      slug: true,
      publicId: true,
      name: true,
    },
  });

  if (!business) redirect('/login');

  const deals = await prisma.deal.findMany({
    where: {
      businessId: session.user.id,
      active: true,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, title: true, discountType: true, discountValue: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <CustomerViewPage
      business={business}
      deals={deals}
      appUrl={APP_URL}
    />
  );
}
