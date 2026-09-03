-- 公司午休分鐘數；工時計算時會從 (punchOut - punchIn) 扣除
ALTER TABLE "companies"
  ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 60;
