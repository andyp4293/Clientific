export interface PublicBusinessContactPrivacyFields {
  phone: string | null;
  businessEmail: string | null;
  publicProfileShowPhone: boolean;
  publicProfileShowEmail: boolean;
}

export function sanitizePublicBusiness<T extends PublicBusinessContactPrivacyFields>(business: T): T {
  return {
    ...business,
    phone: null,
    businessEmail: null,
    publicProfileShowPhone: false,
    publicProfileShowEmail: false,
  };
}
