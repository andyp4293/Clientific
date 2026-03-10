interface PublicProfileVisibilityInput {
  publicProfileShowPhone: boolean;
  publicProfileShowEmail: boolean;
  publicProfileShowAddress: boolean;
  publicProfileShowHours: boolean;
  publicProfileShowServices: boolean;
  publicProfileShowTeam: boolean;
  publicProfileShowSocialLinks: boolean;
  phone?: string | null;
  businessEmail?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
}

export function getPublicProfileVisibility(input: PublicProfileVisibilityInput) {
  const hasAddress = Boolean(input.street && input.city && input.state);

  return {
    showPhone: input.publicProfileShowPhone && Boolean(input.phone),
    showEmail: input.publicProfileShowEmail && Boolean(input.businessEmail),
    showAddress: input.publicProfileShowAddress && hasAddress,
    showHours: input.publicProfileShowHours,
    showServices: input.publicProfileShowServices,
    showTeam: input.publicProfileShowTeam,
    showSocialLinks: input.publicProfileShowSocialLinks,
  };
}
