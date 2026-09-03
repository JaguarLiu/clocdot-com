/*
  Warnings:

  - The `empNo` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "empNo",
ADD COLUMN     "empNo" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "users_empNo_key" ON "users"("empNo");
