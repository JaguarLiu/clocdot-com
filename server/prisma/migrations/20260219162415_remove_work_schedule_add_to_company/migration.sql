/*
  Warnings:

  - You are about to drop the column `work_schedule_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `work_schedules` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_work_schedule_id_fkey";

-- DropForeignKey
ALTER TABLE "work_schedules" DROP CONSTRAINT "work_schedules_company_id_fkey";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "work_end_time" TEXT,
ADD COLUMN     "work_start_time" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "work_schedule_id";

-- DropTable
DROP TABLE "work_schedules";
