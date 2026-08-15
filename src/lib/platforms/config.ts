export function isLinkedInRealEnabled(): boolean {
  if (process.env.LINKEDIN_ADAPTER === "real") return true;
  if (process.env.LINKEDIN_ADAPTER === "mock") return false;
  return Boolean(
    process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET,
  );
}
