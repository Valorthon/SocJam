-- Unique index on (userId, platform, platformUserId).
--
-- Closes the finalize race surfaced in PR #8 review: two concurrent OAuth
-- finalize calls for the same connected account could both pass findFirst,
-- then both create, producing duplicate SocialAccount rows. The existing
-- @@unique([userId, platform, handle]) only catches this incidentally
-- (Instagram handle = IG id); for Facebook the handle is the Page name,
-- which can differ across reconnects.
--
-- Postgres treats NULLs as distinct in unique indexes, so rows without a
-- platform-side id (mock accounts, platformUserId IS NULL) remain
-- unconstrained -- same semantics as a partial index
-- `WHERE "platformUserId" IS NOT NULL`, but expressible in the Prisma
-- schema so `upsert` can target the compound key.
--
-- NOTE: creation fails if duplicate (userId, platform, platformUserId)
-- triples already exist. On a database with such duplicates, dedupe
-- (keep the most recently updated row per triple) before applying.

CREATE UNIQUE INDEX "SocialAccount_userId_platform_platformUserId_key"
ON "SocialAccount"("userId", "platform", "platformUserId");
