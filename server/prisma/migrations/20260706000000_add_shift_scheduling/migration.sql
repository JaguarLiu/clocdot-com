-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "defaultShiftId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "shifts_companyId_name_key" ON "shifts"("companyId", "name");
CREATE INDEX "shifts_companyId_idx" ON "shifts"("companyId");
CREATE UNIQUE INDEX "shift_assignments_userId_date_key" ON "shift_assignments"("userId", "date");
CREATE INDEX "shift_assignments_shiftId_idx" ON "shift_assignments"("shiftId");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_defaultShiftId_fkey" FOREIGN KEY ("defaultShiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 資料轉換：每間有設定上下班時間的公司 → 建立「一般班」(isDefault)
INSERT INTO "shifts" ("id", "companyId", "name", "startTime", "endTime", "breakMinutes", "isDefault", "updatedAt")
SELECT gen_random_uuid(), c."id", '一般班', c."workStartTime", c."workEndTime", c."breakMinutes", true, CURRENT_TIMESTAMP
FROM "companies" c
WHERE c."workStartTime" IS NOT NULL AND c."workEndTime" IS NOT NULL;

-- 全員預設班指到自己公司的「一般班」
UPDATE "users" u
SET "defaultShiftId" = s."id"
FROM "shifts" s
WHERE s."companyId" = u."companyId" AND s."isDefault" = true;

-- 移除公司層級上下班時間（已轉換為班別）
ALTER TABLE "companies" DROP COLUMN "workStartTime";
ALTER TABLE "companies" DROP COLUMN "workEndTime";
