import { sanitizeExternalHttpUrl } from '@/lib/safe-url';

export interface PublicBusinessContactPrivacyFields {
  phone: string | null;
  businessEmail: string | null;
  publicProfileShowPhone: boolean;
  publicProfileShowEmail: boolean;
  logoUrl?: string | null;
  googleReviewUrl?: string | null;
  facebookPageUrl?: string | null;
  yelpUrl?: string | null;
  instagramUrl?: string | null;
}

export function sanitizePublicBusiness<T extends PublicBusinessContactPrivacyFields>(business: T): T {
  const hasField = (field: keyof PublicBusinessContactPrivacyFields) =>
    Object.prototype.hasOwnProperty.call(business, field);

  return {
    ...business,
    phone: null,
    businessEmail: null,
    publicProfileShowPhone: false,
    publicProfileShowEmail: false,
    ...(hasField('logoUrl') ? { logoUrl: sanitizeExternalHttpUrl(business.logoUrl) } : {}),
    ...(hasField('googleReviewUrl')
      ? { googleReviewUrl: sanitizeExternalHttpUrl(business.googleReviewUrl) }
      : {}),
    ...(hasField('facebookPageUrl')
      ? { facebookPageUrl: sanitizeExternalHttpUrl(business.facebookPageUrl) }
      : {}),
    ...(hasField('yelpUrl') ? { yelpUrl: sanitizeExternalHttpUrl(business.yelpUrl) } : {}),
    ...(hasField('instagramUrl')
      ? { instagramUrl: sanitizeExternalHttpUrl(business.instagramUrl) }
      : {}),
  };
}
