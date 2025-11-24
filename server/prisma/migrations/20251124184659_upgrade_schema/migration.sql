/*
  Warnings:

  - You are about to drop the column `timestamp` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `savedBy` on the `WhiteboardSnapshot` table. All the data in the column will be lost.
  - Added the required column `savedById` to the `WhiteboardSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."RoomParticipant" DROP CONSTRAINT "RoomParticipant_roomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RoomParticipant" DROP CONSTRAINT "RoomParticipant_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WhiteboardSnapshot" DROP CONSTRAINT "WhiteboardSnapshot_roomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WhiteboardSnapshot" DROP CONSTRAINT "WhiteboardSnapshot_savedBy_fkey";

-- AlterTable
ALTER TABLE "public"."Message" DROP COLUMN "timestamp",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."RoomParticipant" ADD COLUMN     "leftAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."WhiteboardSnapshot" DROP COLUMN "savedBy",
ADD COLUMN     "savedById" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Message_roomId_createdAt_idx" ON "public"."Message"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "Room_ownerId_idx" ON "public"."Room"("ownerId");

-- CreateIndex
CREATE INDEX "RoomParticipant_roomId_idx" ON "public"."RoomParticipant"("roomId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "WhiteboardSnapshot_roomId_createdAt_idx" ON "public"."WhiteboardSnapshot"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."RoomParticipant" ADD CONSTRAINT "RoomParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomParticipant" ADD CONSTRAINT "RoomParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WhiteboardSnapshot" ADD CONSTRAINT "WhiteboardSnapshot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WhiteboardSnapshot" ADD CONSTRAINT "WhiteboardSnapshot_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
