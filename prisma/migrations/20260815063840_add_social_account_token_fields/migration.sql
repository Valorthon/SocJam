-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "platformUserId" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "scope" TEXT;
