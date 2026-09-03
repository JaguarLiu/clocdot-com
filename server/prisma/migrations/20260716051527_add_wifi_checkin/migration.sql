-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "punchInIp" TEXT,
ADD COLUMN     "punchOutIp" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "wifiCheckinEnabled" BOOLEAN NOT NULL DEFAULT false;
