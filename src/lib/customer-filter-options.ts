export const CUSTOMER_SEGMENTS = ["NEW", "REGULAR", "VIP", "AT_RISK", "CHURNED"] as const;

export type CustomerSegmentFilter = (typeof CUSTOMER_SEGMENTS)[number];

export const CUSTOMER_SMS_FILTERS = ["enabled", "opted_out", "denied", "no_phone"] as const;

export type CustomerSmsFilter = (typeof CUSTOMER_SMS_FILTERS)[number];

export const CUSTOMER_CONTACT_FILTERS = ["email", "phone", "both"] as const;

export type CustomerContactFilter = (typeof CUSTOMER_CONTACT_FILTERS)[number];

export const CUSTOMER_VISIT_FILTERS = ["visited", "never"] as const;

export type CustomerVisitFilter = (typeof CUSTOMER_VISIT_FILTERS)[number];
