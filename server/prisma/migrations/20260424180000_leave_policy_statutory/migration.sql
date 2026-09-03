-- 特休依年資自動計算開關 (勞基法 §38)
ALTER TABLE "leave_policies"
  ADD COLUMN "useStatutoryRule" BOOLEAN NOT NULL DEFAULT false;
