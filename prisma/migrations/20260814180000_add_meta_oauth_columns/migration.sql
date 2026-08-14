-- Phase 2a: real OAuth columns for SocialAccount (Meta integration).
-- All columns are nullable so existing mock-connected accounts remain valid.
ALTER TABLE "SocialAccount" ADD COLUMN "externalAccountId"        TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "refreshTokenEncrypted"    TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN "tokenExpiresAt"          TIMESTAMP(3);
ALTER TABLE "SocialAccount" ADD COLUMN "metaUserId"             TEXT;

-- A user can only connect one record per platform+externalAccountId per tenant.
-- Postgres treats NULLs as distinct, so mock accounts (externalAccountId NULL)
-- are not constrained by this unique index.
CREATE UNIQUE INDEX "SocialAccount_userId_platform_externalAccountId_key"
  ON "SocialAccount" ("userId", "platform", "externalAccountId");