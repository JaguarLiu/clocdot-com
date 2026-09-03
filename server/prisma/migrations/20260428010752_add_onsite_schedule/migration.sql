-- AlterTable
ALTER TABLE "companies"
  ADD COLUMN "onsiteCycleWeeks"      INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN "onsiteWeekdaysByCycle" JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN "onsiteMonthDays"       INTEGER[]   NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "scheduleAnchorDate"    DATE;
