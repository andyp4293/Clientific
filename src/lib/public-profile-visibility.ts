interface PublicProfileVisibilityInput {
  publicProfileShowAddress: boolean;
  publicProfileShowHours: boolean;
  publicProfileShowServices: boolean;
  publicProfileShowTeam: boolean;
  publicProfileShowSocialLinks: boolean;
  street?: string | null;
  city?: string | null;
  state?: string | null;
}

export function getPublicProfileVisibility(input: PublicProfileVisibilityInput) {
  const hasAddress = Boolean(input.street && input.city && input.state);

  return {
    showAddress: input.publicProfileShowAddress && hasAddress,
    showHours: input.publicProfileShowHours,
    showServices: input.publicProfileShowServices,
    showTeam: input.publicProfileShowTeam,
    showSocialLinks: input.publicProfileShowSocialLinks,
  };
}
