export function isLinkedInRealEnabled(): boolean {
  const adapter =
    process.env.LINKEDIN_ADAPTER ?? process.env.NEXT_PUBLIC_LINKEDIN_ADAPTER;
  if (adapter === "real") return true;
  if (adapter === "mock") return false;
  return Boolean(
    process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET,
  );
}
