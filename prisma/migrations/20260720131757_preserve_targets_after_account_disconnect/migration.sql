-- Preserve post history when a connected social account is removed.
ALTER TABLE "PostTarget" ALTER COLUMN "accountId" DROP NOT NULL;

ALTER TABLE "PostTarget" DROP CONSTRAINT "PostTarget_accountId_fkey";

ALTER TABLE "PostTarget" ADD CONSTRAINT "PostTarget_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
