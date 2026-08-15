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

function isMetaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function isFacebookRealEnabled(): boolean {
  const adapter = metaAdapterFlag("FACEBOOK");
  if (adapter === "real") return true;
  if (adapter === "mock") return false;
  return isMetaConfigured();
}

export function isInstagramRealEnabled(): boolean {
  const adapter = metaAdapterFlag("INSTAGRAM");
  if (adapter === "real") return true;
  if (adapter === "mock") return false;
  return isMetaConfigured();
}
