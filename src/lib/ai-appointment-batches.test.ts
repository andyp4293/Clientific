import { describe, expect, it } from 'vitest';

import { buildAiAppointmentBatchWhereInput } from './ai-appointment-batches';

describe('buildAiAppointmentBatchWhereInput', () => {
  it('matches AI appointments created or updated during the buffered call window', () => {
    const where = buildAiAppointmentBatchWhereInput(
      'biz-1',
      '+15551234567',
      1_000,
      2_000
    );

    expect(where).toEqual(
      expect.objectContaining({
        businessId: 'biz-1',
        source: 'ai',
        OR: [
          {
            createdAt: {
              gte: new Date(1_000),
              lte: new Date(2_000),
            },
          },
          {
            updatedAt: {
              gte: new Date(1_000),
              lte: new Date(2_000),
            },
          },
        ],
        customer: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ phoneLookupKey: '5551234567' }),
          ]),
        }),
      })
    );
  });
});
