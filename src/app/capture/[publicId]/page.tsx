import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import CaptureKiosk from './CaptureKiosk';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getInStoreCaptureConfig } from '@/lib/in-store-capture';
import { getSessionBusinessId } from '@/lib/session-business';

export const dynamic = 'force-dynamic';

export default async function CapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ deal?: string }>;
}) {
  const [{ publicId }, { deal }, session] = await Promise.all([
    params,
    searchParams,
    getServerSession(authOptions),
  ]);
  const config = await getInStoreCaptureConfig({
    publicId,
    dealId: deal,
    sessionBusinessId: getSessionBusinessId(session),
  });

  if (!config) {
    notFound();
  }

  return <CaptureKiosk config={config} />;
}
