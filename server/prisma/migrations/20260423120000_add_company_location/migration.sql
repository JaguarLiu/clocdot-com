-- 新增公司地點表，支援一家公司多個辦公據點 + 未來的地理圍欄打卡

CREATE TABLE "company_locations" (
  "id"        TEXT        NOT NULL,
  "companyId" TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "address"   TEXT        NOT NULL,
  "lat"       DOUBLE PRECISION,
  "lng"       DOUBLE PRECISION,
  "radius"    INTEGER     NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_locations_companyId_idx" ON "company_locations"("companyId");

ALTER TABLE "company_locations"
  ADD CONSTRAINT "company_locations_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
