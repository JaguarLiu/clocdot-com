-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "regularLeaveWeekdays" INTEGER[] DEFAULT ARRAY[7]::INTEGER[],
ADD COLUMN     "restDayWeekdays" INTEGER[] DEFAULT ARRAY[6]::INTEGER[],
ADD COLUMN     "standardDailyMinutes" INTEGER NOT NULL DEFAULT 480,
ADD COLUMN     "workdayWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];

-- CreateTable
CREATE TABLE "company_day_exceptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayType" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_day_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "derivedMinutes" INTEGER NOT NULL,
    "requestedMinutes" INTEGER NOT NULL,
    "dayType" TEXT NOT NULL,
    "tiers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_day_exceptions_companyId_idx" ON "company_day_exceptions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_day_exceptions_companyId_date_key" ON "company_day_exceptions"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_requests_userId_workDate_key" ON "overtime_requests"("userId", "workDate");

-- AddForeignKey
ALTER TABLE "company_day_exceptions" ADD CONSTRAINT "company_day_exceptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
