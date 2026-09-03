-- 重新命名 useStatutoryRule → useProrationRule (行為改為「第一年按到職日比例給予」)
ALTER TABLE "leave_policies" RENAME COLUMN "useStatutoryRule" TO "useProrationRule";
