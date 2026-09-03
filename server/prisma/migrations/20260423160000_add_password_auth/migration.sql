-- 密碼登入 + 鎖定機制
ALTER TABLE "users"
  ADD COLUMN "password"         TEXT,
  ADD COLUMN "failedLoginCount" INTEGER    NOT NULL DEFAULT 0,
  ADD COLUMN "lockedAt"         TIMESTAMP(3);
