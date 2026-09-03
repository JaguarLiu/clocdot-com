-- 移除 useProrationRule flag — 特休一律自動依年資比例給予 (年資 < 1yr 比例制；≥ 1yr 給滿)
ALTER TABLE "leave_policies" DROP COLUMN "useProrationRule";
