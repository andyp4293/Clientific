import { Prisma } from '@prisma/client';
import { buildCustomerPhoneMatchClauses } from '@/lib/phone';

const APPOINTMENT_BATCH_BUFFER_MS = 60_000;

export function getBufferedAppointmentBatchWindow(startedAt: Date, endedAt: Date = new Date()) {
  return {
    startMs: Math.max(0, startedAt.getTime() - APPOINTMENT_BATCH_BUFFER_MS),
    endMs: endedAt.getTime() + APPOINTMENT_BATCH_BUFFER_MS,
  };
}

export function buildAiAppointmentBatchWhereInput(
  businessId: string,
  callerPhone: string,
  startMs: number,
  endMs: number
): Prisma.AppointmentWhereInput {
  const phoneClauses = buildCustomerPhoneMatchClauses(callerPhone);

  if (phoneClauses.length === 0) {
    return {
      id: '__no_matching_appointments__',
    };
  }

  return {
    businessId,
    source: 'ai',
    createdAt: {
      gte: new Date(startMs),
      lte: new Date(endMs),
    },
    customer: {
      OR: phoneClauses,
    },
  };
}
