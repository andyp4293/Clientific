import { formatPhoneForDisplay } from '@/lib/phone';

const SEGMENT_LABELS: Record<string, string> = {
  NEW: 'New',
  REGULAR: 'Regular',
  VIP: 'VIP',
  AT_RISK: 'At Risk',
  CHURNED: 'Churned',
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  confirmation: 'Booking Confirmed',
  reminder: 'Reminder',
  cancellation: 'Cancellation',
  reschedule: 'Reschedule',
  review_request: 'Review Request',
  custom: 'Direct Message',
  customer_broadcast: 'Customer Broadcast',
};

export function formatCustomerDateLabel(value: Date | null | undefined) {
  if (!value) {
    return 'Never';
  }

  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCustomerDateTimeLabel(value: Date | string | null | undefined) {
  if (!value) {
    return 'Never';
  }

  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatCustomerCurrencyLabel(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value ?? 0);
}

export function getCustomerSegmentLabel(segment: string | null | undefined) {
  if (!segment) {
    return 'Customer';
  }

  return SEGMENT_LABELS[segment] ?? segment;
}

export function getAppointmentStatusLabel(status: string | null | undefined) {
  if (!status) {
    return 'Scheduled';
  }

  return APPOINTMENT_STATUS_LABELS[status] ?? status;
}

export function getMessageTypeLabel(messageType: string | null | undefined) {
  if (!messageType) {
    return 'Message';
  }

  return MESSAGE_TYPE_LABELS[messageType] ?? messageType;
}

export function formatCustomerGroupRecord(group: {
  id: string;
  name: string;
  promotionSmsEnabled: boolean;
  _count?: {
    memberships?: number;
  };
}) {
  return {
    id: group.id,
    name: group.name,
    promotionSmsEnabled: group.promotionSmsEnabled,
    membersCount: group._count?.memberships ?? 0,
  };
}

export function formatCustomerGroupBadge(group: {
  id: string;
  name: string;
  promotionSmsEnabled: boolean;
}) {
  return {
    id: group.id,
    name: group.name,
    promotionSmsEnabled: group.promotionSmsEnabled,
  };
}

export function formatMobileCustomerRecord(customer: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  lastVisit: Date | null;
  totalSpent: number | null;
  segment: string;
  smsConsent: boolean;
  smsMarketingConsent: boolean;
  smsOptedOut: boolean;
  dealSmsBlocked?: boolean | null;
  _count: {
    checkIns: number;
  };
  groupMemberships: Array<{
    group: {
      id: string;
      name: string;
      promotionSmsEnabled: boolean;
    };
  }>;
}) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    phoneDisplay: formatPhoneForDisplay(customer.phone),
    joinedLabel: formatCustomerDateLabel(customer.createdAt),
    lastVisitLabel: formatCustomerDateLabel(customer.lastVisit),
    totalSpentLabel: formatCustomerCurrencyLabel(customer.totalSpent),
    segment: customer.segment,
    segmentLabel: getCustomerSegmentLabel(customer.segment),
    smsConsent: customer.smsConsent,
    smsMarketingConsent: customer.smsMarketingConsent,
    smsOptedOut: customer.smsOptedOut,
    dealSmsBlocked: customer.dealSmsBlocked === true,
    visitsCount: customer._count.checkIns,
    groups: customer.groupMemberships.map(({ group }) => formatCustomerGroupBadge(group)),
  };
}

export function formatMobileCustomerDetail(customer: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: Date | null;
  notes: string | null;
  createdAt: Date;
  lastVisit: Date | null;
  totalSpent: number | null;
  segment: string;
  smsConsent: boolean;
  smsMarketingConsent: boolean;
  smsOptedOut: boolean;
  dealSmsBlocked?: boolean | null;
  _count: {
    checkIns: number;
    appointments: number;
  };
  groupMemberships: Array<{
    group: {
      id: string;
      name: string;
      promotionSmsEnabled: boolean;
    };
  }>;
  checkIns: Array<{
    id: string;
    createdAt: Date;
    amountSpent: number | null;
  }>;
  appointments: Array<{
    id: string;
    startTime: Date;
    status: string;
    service: {
      name: string;
    } | null;
    staff: {
      fullName: string;
    } | null;
  }>;
}) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    phoneDisplay: formatPhoneForDisplay(customer.phone),
    birthdayValue: customer.birthday
      ? customer.birthday.toLocaleDateString('en-CA')
      : '',
    birthdayLabel: customer.birthday
      ? customer.birthday.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Not provided',
    notes: customer.notes,
    segment: customer.segment,
    segmentLabel: getCustomerSegmentLabel(customer.segment),
    joinedLabel: formatCustomerDateLabel(customer.createdAt),
    lastVisitLabel: formatCustomerDateLabel(customer.lastVisit),
    totalSpentLabel: formatCustomerCurrencyLabel(customer.totalSpent),
    smsConsent: customer.smsConsent,
    smsMarketingConsent: customer.smsMarketingConsent,
    smsOptedOut: customer.smsOptedOut,
    dealSmsBlocked: customer.dealSmsBlocked === true,
    visitsCount: customer._count.checkIns,
    appointmentsCount: customer._count.appointments,
    groups: customer.groupMemberships.map(({ group }) => formatCustomerGroupBadge(group)),
    checkIns: customer.checkIns.map((checkIn) => ({
      id: checkIn.id,
      createdAtLabel: formatCustomerDateTimeLabel(checkIn.createdAt),
      amountSpentLabel: formatCustomerCurrencyLabel(checkIn.amountSpent),
    })),
    appointments: customer.appointments.map((appointment) => ({
      id: appointment.id,
      startTimeLabel: formatCustomerDateTimeLabel(appointment.startTime),
      status: appointment.status,
      statusLabel: getAppointmentStatusLabel(appointment.status),
      serviceName: appointment.service?.name ?? 'General appointment',
      staffName: appointment.staff?.fullName ?? null,
    })),
  };
}

export function formatMobileDirectMessageQuota(quota: {
  limit: number;
  used: number;
  remaining: number;
  periodEnd: string | Date;
  isActive: boolean;
} | null) {
  if (!quota) {
    return null;
  }

  return {
    ...quota,
    periodEnd: quota.periodEnd instanceof Date ? quota.periodEnd.toISOString() : quota.periodEnd,
    periodEndLabel: formatCustomerDateLabel(
      quota.periodEnd instanceof Date ? quota.periodEnd : new Date(quota.periodEnd),
    ),
  };
}

export function formatMobileSmsLog(log: {
  id: string;
  createdAt: Date | string;
  messageType: string;
  status: string;
  message: string;
}) {
  return {
    id: log.id,
    createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
    createdAtLabel: formatCustomerDateTimeLabel(log.createdAt),
    messageType: log.messageType,
    messageTypeLabel: getMessageTypeLabel(log.messageType),
    status: log.status,
    message: log.message,
  };
}
