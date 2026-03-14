import { notFound } from 'next/navigation';
import CaptureKiosk from './CaptureKiosk';
import { getInStoreCaptureConfig } from '@/lib/in-store-capture';

export const dynamic = 'force-dynamic';

export default async function CapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ deal?: string }>;
}) {
  const [{ publicId }, { deal }] = await Promise.all([params, searchParams]);
  const config = await getInStoreCaptureConfig({ publicId, dealId: deal });

  if (!config) {
    notFound();
  }

  return <CaptureKiosk config={config} />;
}
