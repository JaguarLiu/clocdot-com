-- 假別額度：新增 LeavePolicy 表、公司年度重置模式、員工到職日；
-- 既有 LeaveRequest.leaveType 從 `*_leave` 舊名 canonicalize 成 enum 值

-- 1. 新 LeavePolicy 表
CREATE TABLE "leave_policies" (
  "id"                  TEXT         NOT NULL,
  "companyId"           TEXT         NOT NULL,
  "leaveType"           TEXT         NOT NULL,
  "annualQuotaMinutes"  INTEGER      NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leave_policies_companyId_leaveType_key"
  ON "leave_policies"("companyId", "leaveType");

ALTER TABLE "leave_policies"
  ADD CONSTRAINT "leave_policies_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Company 加年度重置模式
ALTER TABLE "companies"
  ADD COLUMN "leavePolicyYearReset" TEXT NOT NULL DEFAULT 'anniversary';

-- 3. User 加到職日
ALTER TABLE "users"
  ADD COLUMN "hireDate" DATE;

-- 4. 把既有 LeaveRequest.leaveType 舊字串 canonicalize
UPDATE "leave_requests" SET "leaveType" =
  CASE "leaveType"
    WHEN 'annual_leave'        THEN 'annual'
    WHEN 'sick_leave'          THEN 'sick'
    WHEN 'personal_leave'      THEN 'personal'
    WHEN 'compensatory_leave'  THEN 'compensatory'
    ELSE "leaveType"
  END;

-- 同步彙總寫回 AttendanceRecord 的標記 (先前 Leave approved 時可能寫入舊字串)
UPDATE "attendance_records" SET "leaveType" =
  CASE "leaveType"
    WHEN 'annual_leave'        THEN 'annual'
    WHEN 'sick_leave'          THEN 'sick'
    WHEN 'personal_leave'      THEN 'personal'
    WHEN 'compensatory_leave'  THEN 'compensatory'
    ELSE "leaveType"
  END;
