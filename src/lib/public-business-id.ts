import { prisma } from '@/lib/prisma';

export const PUBLIC_BUSINESS_ID_REGEX = /^[A-Z]{2}-[A-Z0-9]{6}$/;

export function isPublicBusinessId(value: string): boolean {
  return PUBLIC_BUSINESS_ID_REGEX.test(value.toUpperCase());
}

export async function resolvePublicBusinessIdOrNull(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const normalizedPublicId = trimmed.toUpperCase();
  if (PUBLIC_BUSINESS_ID_REGEX.test(normalizedPublicId)) {
    const byPublicId = await prisma.business.findUnique({
      where: { publicId: normalizedPublicId },
      select: { publicId: true },
    });
    return byPublicId?.publicId ?? null;
  }

  const bySlug = await prisma.business.findUnique({
    where: { slug: trimmed },
    select: { publicId: true },
  });
  return bySlug?.publicId ?? null;
}
