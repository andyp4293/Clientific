import { notFound, redirect } from 'next/navigation';
import { resolvePublicBusinessIdOrNull } from '@/lib/public-business-id';

export default async function LegacyBusinessProfileRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const publicId = await resolvePublicBusinessIdOrNull(slug);

  if (!publicId) {
    notFound();
  }

  redirect(`/business/${publicId}`);
}
