-- 地理圍欄：把 gps 欄位拆成上班/下班兩組，新增 locationId / locationType 標記

ALTER TABLE "attendance_records" RENAME COLUMN "gpsLat" TO "punchInLat";
ALTER TABLE "attendance_records" RENAME COLUMN "gpsLng" TO "punchInLng";

ALTER TABLE "attendance_records"
  ADD COLUMN "punchInLocationId"    TEXT,
  ADD COLUMN "punchInLocationType"  TEXT,
  ADD COLUMN "punchOutLat"          DOUBLE PRECISION,
  ADD COLUMN "punchOutLng"          DOUBLE PRECISION,
  ADD COLUMN "punchOutLocationId"   TEXT,
  ADD COLUMN "punchOutLocationType" TEXT;
