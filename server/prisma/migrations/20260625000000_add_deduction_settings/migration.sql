-- 公司：工時類型 + 固定工時扣薪方式
ALTER TABLE "companies" ADD COLUMN     "workHourType" TEXT NOT NULL DEFAULT 'flexible';
ALTER TABLE "companies" ADD COLUMN     "lateDeductMode" TEXT NOT NULL DEFAULT 'per_minute';

-- 假別政策：扣薪比例（null = 用系統預設 personal=1, sick=0.5, 其餘 0）
ALTER TABLE "leave_policies" ADD COLUMN     "deductRate" DOUBLE PRECISION;
