export type OnboardingRedirect = "/login" | "/dashboard" | null;

export function getOnboardingRedirect({
  isAuthenticated,
  hasConnectedAccount,
}: {
  isAuthenticated: boolean;
  hasConnectedAccount: boolean;
}): OnboardingRedirect {
  if (!isAuthenticated) return "/login";
  if (hasConnectedAccount) return "/dashboard";
  return null;
}
