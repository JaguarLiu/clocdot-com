-- 彈性工時旗標：true → 月上限 54h 且啟用每 3 個月 138h 滾動上限；false → 月上限 46h
ALTER TABLE "companies"
  ADD COLUMN "flexibleOvertime" BOOLEAN NOT NULL DEFAULT false;
