type BusinessOnboardingFields = {
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
};

function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isBusinessOnboardingComplete(
  business: BusinessOnboardingFields | null | undefined
): boolean {
  if (!business) {
    return false;
  }

  return (
    hasValue(business.phone) &&
    hasValue(business.street) &&
    hasValue(business.city) &&
    hasValue(business.state) &&
    hasValue(business.zipCode) &&
    hasValue(business.country)
  );
}
