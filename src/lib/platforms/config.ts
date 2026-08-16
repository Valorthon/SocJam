export function isLinkedInRealEnabled(): boolean {
  const adapter =
    process.env.LINKEDIN_ADAPTER ?? process.env.NEXT_PUBLIC_LINKEDIN_ADAPTER;
  if (adapter === "real") return true;
  if (adapter === "mock") return false;
  return Boolean(
    process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET,
  );
}

export function isTikTokRealEnabled(): boolean {
  const adapter =
    process.env.TIKTOK_ADAPTER ?? process.env.NEXT_PUBLIC_TIKTOK_ADAPTER;
  if (adapter === "real") return true;
  if (adapter === "mock") return false;
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET,
  );
}

function metaAdapterFlag(platform: "FACEBOOK" | "INSTAGRAM"): string | undefined {
  return (
    process.env[`${platform}_ADAPTER`] ??
    process.env[`NEXT_PUBLIC_${platform}_ADAPTER`]
  );
}

/**
 * Meta app credentials present. Gates auto-enablement of the real FB/IG
 * adapters only — publishing works with stored Page tokens and doesn't need
 * the OAuth redirect config. The connect flow itself uses the stricter
 * isMetaConfigured() in oauth/meta.ts (all loadMetaConfig env vars).
 */
function hasMetaAppCredentials(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function isFacebookRealEnabled(): boolean {
  const adapter = metaAdapterFlag("FACEBOOK");
  if (adapter === "real") return true;
  if (adapter === "mock") return false;
  return hasMetaAppCredentials();
}

export function isInstagramRealEnabled(): boolean {
  const adapter = metaAdapterFlag("INSTAGRAM");
  if (adapter === "real") return true;
  if (adapter === "mock") return false;
  return hasMetaAppCredentials();
}
