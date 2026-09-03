-- CreateTable
CREATE TABLE "salary_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "allowances" JSONB NOT NULL DEFAULT '[]',
    "laborInsuredSalary" INTEGER,
    "healthInsuredSalary" INTEGER,
    "healthDependents" INTEGER NOT NULL DEFAULT 0,
    "pensionVoluntaryRate" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "taxDependents" INTEGER NOT NULL DEFAULT 0,
    "bankAccount" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_profiles_userId_key" ON "salary_profiles"("userId");

-- AddForeignKey
ALTER TABLE "salary_profiles" ADD CONSTRAINT "salary_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
