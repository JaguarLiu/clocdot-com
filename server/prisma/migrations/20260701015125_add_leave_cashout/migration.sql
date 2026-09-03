-- CreateTable
CREATE TABLE "leave_cashouts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "days" DECIMAL(5,2) NOT NULL,
    "dailyWage" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "leave_cashouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_cashouts_userId_month_key" ON "leave_cashouts"("userId", "month");

-- AddForeignKey
ALTER TABLE "leave_cashouts" ADD CONSTRAINT "leave_cashouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
