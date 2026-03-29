export const SHARED_REFERENCE_DATA_REVALIDATE_SECONDS = 60;
export const BUSINESS_HOURS_REVALIDATE_SECONDS = 300;

export function getBusinessCacheTag(businessId: string) {
  return `business-${businessId}`;
}

export function getServicesCacheTag(businessId: string) {
  return `services-${businessId}`;
}

export function getServiceGroupsCacheTag(businessId: string) {
  return `service-groups-${businessId}`;
}

export function getCustomerGroupsCacheTag(businessId: string) {
  return `customer-groups-${businessId}`;
}

export function getStaffCacheTag(businessId: string) {
  return `staff-${businessId}`;
}

export function getBusinessHoursCacheTag(businessId: string) {
  return `business-hours-${businessId}`;
}
