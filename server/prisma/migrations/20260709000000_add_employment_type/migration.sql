-- AlterTable: 僱用類型,既有員工全部 regular(行為不變)
ALTER TABLE "users" ADD COLUMN "employmentType" TEXT NOT NULL DEFAULT 'regular';
