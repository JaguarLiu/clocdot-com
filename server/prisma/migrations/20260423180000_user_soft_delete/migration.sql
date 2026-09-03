-- 員工軟刪除：離職員工保留出勤歷史，但無法登入、admin 列表不顯示
ALTER TABLE "users"
  ADD COLUMN "deletedAt" TIMESTAMP(3);
