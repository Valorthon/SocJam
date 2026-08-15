/*
  Warnings:

  - Added the required column `mimeType` to the `MediaAsset` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "mimeType" TEXT NOT NULL;
