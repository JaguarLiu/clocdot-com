ALTER TABLE "salary_profiles" ALTER COLUMN "baseSalary" DROP NOT NULL;
ALTER TABLE "salary_profiles" ADD COLUMN "hourlyRate" INTEGER;
