-- 將 AttendanceRecord.status 字串拆成多個語意欄位

-- 1. 加上新欄位（給預設值避免既有 row 失敗）
ALTER TABLE "attendance_records"
  ADD COLUMN "isLate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isEarlyLeave" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "leaveType" TEXT,
  ADD COLUMN "isHoliday" BOOLEAN NOT NULL DEFAULT false;

-- 2. 從舊 status 字串回填新欄位
UPDATE "attendance_records"
SET "isLate" = true
WHERE "status" IN ('late', 'late_and_early_leave');

UPDATE "attendance_records"
SET "isEarlyLeave" = true
WHERE "status" IN ('early_leave', 'late_and_early_leave');

-- 3. 移除舊 status 欄位
ALTER TABLE "attendance_records" DROP COLUMN "status";
