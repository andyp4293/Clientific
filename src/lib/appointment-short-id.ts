import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const SHORT_ID_LENGTH = 7;
const MAX_SHORT_ID_ATTEMPTS = 5;

function createAppointmentShortId() {
  return crypto.randomBytes(6).toString('base64url').slice(0, SHORT_ID_LENGTH).toUpperCase();
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function ensureAppointmentShortId(
  appointmentId: string,
  currentShortId?: string | null,
) {
  if (currentShortId) {
    return currentShortId;
  }

  for (let attempt = 0; attempt < MAX_SHORT_ID_ATTEMPTS; attempt += 1) {
    const shortId = createAppointmentShortId();

    try {
      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { shortId },
        select: { shortId: true },
      });

      return updated.shortId;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Failed to generate a unique appointment short ID.');
}
