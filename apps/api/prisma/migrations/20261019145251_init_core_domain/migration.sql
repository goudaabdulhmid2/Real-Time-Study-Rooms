-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DEACTIVATED', 'ANONYMIZED');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('SCHEDULED', 'PERSISTENT');

-- CreateEnum
CREATE TYPE "RoomVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoomInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ModeratorAssignmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OwnershipTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deactivatedAt" TIMESTAMPTZ(3),
    "anonymizeAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyRoom" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "roomType" "RoomType" NOT NULL,
    "visibility" "RoomVisibility" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "scheduledStartAt" TIMESTAMPTZ(3),
    "scheduledEndAt" TIMESTAMPTZ(3),
    "status" "RoomStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudyRoom_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "StudyRoom"
ADD CONSTRAINT "study_room_capacity_at_least_two_check"
CHECK ("capacity" >= 2);

-- AddCheckConstraint
ALTER TABLE "StudyRoom"
ADD CONSTRAINT "study_room_scheduled_timestamps_check"
CHECK (
    "roomType" <> 'SCHEDULED'
    OR (
        "scheduledStartAt" IS NOT NULL
        AND "scheduledEndAt" IS NOT NULL
        AND "scheduledEndAt" > "scheduledStartAt"
    )
);

-- AddCheckConstraint
ALTER TABLE "StudyRoom"
ADD CONSTRAINT "study_room_persistent_timestamps_null_check"
CHECK (
    "roomType" <> 'PERSISTENT'
    OR (
        "scheduledStartAt" IS NULL
        AND "scheduledEndAt" IS NULL
    )
);

-- AddCheckConstraint
ALTER TABLE "StudyRoom"
ADD CONSTRAINT "study_room_status_room_type_compatibility_check"
CHECK (
    (
        "roomType" = 'SCHEDULED'
        AND "status" IN ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED')
    )
    OR (
        "roomType" = 'PERSISTENT'
        AND "status" IN ('ACTIVE', 'CLOSED', 'ARCHIVED')
    )
);

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomInvitation" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "invitedUserId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "status" "RoomInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomAccessCode" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomAccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomModeratorAssignment" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "status" "ModeratorAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RoomModeratorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransferRequest" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OwnershipTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");

-- CreateIndex
CREATE INDEX "StudyRoom_ownerId_idx" ON "StudyRoom"("ownerId");

-- CreateIndex
CREATE INDEX "StudyRoom_roomType_status_idx" ON "StudyRoom"("roomType", "status");

-- CreateIndex
CREATE INDEX "StudyRoom_visibility_status_idx" ON "StudyRoom"("visibility", "status");

-- CreateIndex
CREATE INDEX "StudyRoom_scheduledStartAt_status_idx" ON "StudyRoom"("scheduledStartAt", "status");

-- CreateIndex
CREATE INDEX "RoomMember_roomId_leftAt_idx" ON "RoomMember"("roomId", "leftAt");

-- CreateIndex
CREATE INDEX "RoomMember_userId_leftAt_joinedAt_idx" ON "RoomMember"("userId", "leftAt", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "room_member_one_active_per_user_room" ON "RoomMember"("roomId", "userId") WHERE ("leftAt" IS NULL);

-- CreateIndex
CREATE INDEX "RoomInvitation_invitedUserId_status_idx" ON "RoomInvitation"("invitedUserId", "status");

-- CreateIndex
CREATE INDEX "RoomInvitation_roomId_status_createdAt_idx" ON "RoomInvitation"("roomId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "room_invitation_one_pending_per_recipient" ON "RoomInvitation"("roomId", "invitedUserId") WHERE ("status" = 'PENDING');

-- CreateIndex
CREATE INDEX "RoomAccessCode_codeHash_idx" ON "RoomAccessCode"("codeHash");

-- CreateIndex
CREATE INDEX "RoomAccessCode_roomId_expiresAt_idx" ON "RoomAccessCode"("roomId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "room_access_code_one_unrevoked_per_room" ON "RoomAccessCode"("roomId") WHERE ("revokedAt" IS NULL);

-- CreateIndex
CREATE INDEX "RoomModeratorAssignment_roomId_status_assignedAt_idx" ON "RoomModeratorAssignment"("roomId", "status", "assignedAt");

-- CreateIndex
CREATE INDEX "RoomModeratorAssignment_userId_status_idx" ON "RoomModeratorAssignment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "moderator_assignment_one_pending_per_user_room" ON "RoomModeratorAssignment"("roomId", "userId") WHERE ("status" = 'PENDING');

-- CreateIndex
CREATE UNIQUE INDEX "moderator_assignment_one_active_per_user_room" ON "RoomModeratorAssignment"("roomId", "userId") WHERE ("status" = 'ACTIVE');

-- CreateIndex
CREATE INDEX "OwnershipTransferRequest_requestedById_status_idx" ON "OwnershipTransferRequest"("requestedById", "status");

-- CreateIndex
CREATE INDEX "OwnershipTransferRequest_targetUserId_status_idx" ON "OwnershipTransferRequest"("targetUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ownership_transfer_one_pending_per_room" ON "OwnershipTransferRequest"("roomId") WHERE ("status" = 'PENDING');

-- AddForeignKey
ALTER TABLE "StudyRoom" ADD CONSTRAINT "StudyRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StudyRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvitation" ADD CONSTRAINT "RoomInvitation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StudyRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvitation" ADD CONSTRAINT "RoomInvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvitation" ADD CONSTRAINT "RoomInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAccessCode" ADD CONSTRAINT "RoomAccessCode_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StudyRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAccessCode" ADD CONSTRAINT "RoomAccessCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomModeratorAssignment" ADD CONSTRAINT "RoomModeratorAssignment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StudyRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomModeratorAssignment" ADD CONSTRAINT "RoomModeratorAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomModeratorAssignment" ADD CONSTRAINT "RoomModeratorAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransferRequest" ADD CONSTRAINT "OwnershipTransferRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StudyRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransferRequest" ADD CONSTRAINT "OwnershipTransferRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransferRequest" ADD CONSTRAINT "OwnershipTransferRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
