-- AlterTable
ALTER TABLE `ApprovalStep` ADD COLUMN `escalatedAt` DATETIME(3) NULL,
    ADD COLUMN `onBehalfOfId` VARCHAR(191) NULL,
    ADD COLUMN `pendingSince` DATETIME(3) NULL,
    ADD COLUMN `remindedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Delegation` (
    `id` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NOT NULL,
    `toUserId` VARCHAR(191) NOT NULL,
    `startsOn` DATE NOT NULL,
    `endsOn` DATE NOT NULL,
    `reason` VARCHAR(300) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    INDEX `Delegation_toUserId_startsOn_endsOn_idx`(`toUserId`, `startsOn`, `endsOn`),
    INDEX `Delegation_fromUserId_idx`(`fromUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` VARCHAR(191) NOT NULL,
    `changeId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Comment_changeId_createdAt_idx`(`changeId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ApprovalStep_status_pendingSince_idx` ON `ApprovalStep`(`status`, `pendingSince`);

-- AddForeignKey
ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_onBehalfOfId_fkey` FOREIGN KEY (`onBehalfOfId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delegation` ADD CONSTRAINT `Delegation_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delegation` ADD CONSTRAINT `Delegation_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delegation` ADD CONSTRAINT `Delegation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_changeId_fkey` FOREIGN KEY (`changeId`) REFERENCES `Change`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: stages already waiting started when the previous stage was decided,
-- or when the change was submitted for the first stage. (MySQL can't read the table
-- it updates, so the previous step comes from a derived copy.)
UPDATE `ApprovalStep` s
  JOIN `Change` c ON c.`id` = s.`changeId`
  LEFT JOIN (SELECT `changeId`, `order`, `decidedAt` FROM (SELECT * FROM `ApprovalStep`) AS copy) prev
    ON prev.`changeId` = s.`changeId` AND prev.`order` = s.`order` - 1
SET s.`pendingSince` = COALESCE(prev.`decidedAt`, c.`submittedAt`)
WHERE s.`status` = 'pending';
