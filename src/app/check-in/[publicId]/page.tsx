import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import CheckInKiosk from './CheckInKiosk';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';

export const dynamic = 'force-dynamic';

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const [{ publicId }, session] = await Promise.all([params, getServerSession(authOptions)]);

  const business = await prisma.business.findUnique({
    where: { publicId },
    select: {
      id: true,
      name: true,
      publicId: true,
      logoUrl: true,
    },
  });

  if (!business) {
    notFound();
  }

  return (
    <CheckInKiosk
      business={{
        name: business.name,
        publicId,
        logoUrl: business.logoUrl,
      }}
      viewerCanManage={getSessionBusinessId(session) === business.id}
    />
  );
}
