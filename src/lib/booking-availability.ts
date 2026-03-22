import type { AvailabilityReason } from '@/lib/public-available-slots';

type EmptyAvailabilityStateInput = {
  availabilityReason?: AvailabilityReason;
  availabilityMessage?: string;
  selectedDate: Date;
  selectedStaffName?: string | null;
};

type EmptyAvailabilityState = {
  title: string;
  description: string;
  tone: 'default' | 'staff_off';
};

function formatBookingDay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function getEmptyAvailabilityState({
  availabilityReason,
  availabilityMessage,
  selectedDate,
  selectedStaffName,
}: EmptyAvailabilityStateInput): EmptyAvailabilityState {
  const formattedDay = formatBookingDay(selectedDate);

  if (availabilityReason === 'staff_off_day') {
    const staffLabel = selectedStaffName?.trim() || 'This staff member';
    return {
      title: `${staffLabel} is off on ${formattedDay}.`,
      description: 'Choose another date, or go back and select Anyone Available to see openings from the rest of the team.',
      tone: 'staff_off',
    };
  }

  if (availabilityReason === 'business_closed') {
    return {
      title: `This business is closed on ${formattedDay}.`,
      description: availabilityMessage || 'Choose another date to see available booking times.',
      tone: 'default',
    };
  }

  return {
    title: `No times are available on ${formattedDay}.`,
    description: 'Try another date or choose a different staff member.',
    tone: 'default',
  };
}
