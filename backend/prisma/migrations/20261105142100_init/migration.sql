-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `role` ENUM('requester', 'lineManager', 'deptHead', 'changeManager', 'cab', 'risk', 'implementer', 'exec', 'admin', 'superAdmin') NOT NULL,
    `status` ENUM('Active', 'Invited', 'Disabled') NOT NULL DEFAULT 'Invited',
    `departmentId` VARCHAR(191) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_code_key`(`code`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `headId` VARCHAR(191) NULL,
    `lineManagerId` VARCHAR(191) NULL,

    UNIQUE INDEX `Department_code_key`(`code`),
    UNIQUE INDEX `Department_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChangeType` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `ChangeType_label_key`(`label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowStage` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `tier` ENUM('Low', 'Medium', 'High', 'Emergency') NOT NULL,
    `order` INTEGER NOT NULL,
    `role` ENUM('requester', 'lineManager', 'deptHead', 'changeManager', 'cab', 'risk', 'implementer', 'exec', 'admin', 'superAdmin') NOT NULL,

    UNIQUE INDEX `WorkflowStage_departmentId_tier_order_key`(`departmentId`, `tier`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreezeWindow` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `from` DATE NOT NULL,
    `to` DATE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Change` (
    `id` VARCHAR(191) NOT NULL,
    `ref` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `reason` TEXT NOT NULL,
    `typeId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `emergency` BOOLEAN NOT NULL DEFAULT false,
    `impact` INTEGER NOT NULL,
    `likelihood` INTEGER NOT NULL,
    `tier` ENUM('Low', 'Medium', 'High', 'Emergency') NOT NULL,
    `customerFacing` BOOLEAN NOT NULL DEFAULT false,
    `regulatory` BOOLEAN NOT NULL DEFAULT false,
    `personalData` BOOLEAN NOT NULL DEFAULT false,
    `systems` JSON NOT NULL,
    `plannedDate` DATE NULL,
    `window` VARCHAR(191) NULL,
    `testPlan` TEXT NULL,
    `rollbackPlan` TEXT NULL,
    `status` ENUM('Draft', 'PendingApproval', 'ReturnedForRework', 'Approved', 'Scheduled', 'InProgress', 'Implemented', 'Closed', 'Rejected') NOT NULL DEFAULT 'Draft',
    `requesterId` VARCHAR(191) NOT NULL,
    `implementerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `submittedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Change_ref_key`(`ref`),
    INDEX `Change_status_idx`(`status`),
    INDEX `Change_plannedDate_idx`(`plannedDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalStep` (
    `id` VARCHAR(191) NOT NULL,
    `changeId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `role` ENUM('requester', 'lineManager', 'deptHead', 'changeManager', 'cab', 'risk', 'implementer', 'exec', 'admin', 'superAdmin') NOT NULL,
    `status` ENUM('waiting', 'pending', 'approved', 'rejected', 'returned', 'skipped') NOT NULL DEFAULT 'waiting',
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `comment` TEXT NULL,

    INDEX `ApprovalStep_role_status_idx`(`role`, `status`),
    UNIQUE INDEX `ApprovalStep_changeId_order_key`(`changeId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChecklistTask` (
    `id` VARCHAR(191) NOT NULL,
    `changeId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `done` BOOLEAN NOT NULL DEFAULT false,
    `doneAt` DATETIME(3) NULL,
    `doneById` VARCHAR(191) NULL,

    UNIQUE INDEX `ChecklistTask_changeId_order_key`(`changeId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(191) NOT NULL,
    `changeId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostImplementationReview` (
    `id` VARCHAR(191) NOT NULL,
    `changeId` VARCHAR(191) NOT NULL,
    `outcome` ENUM('Successful', 'SuccessfulWithIssues', 'Failed', 'RolledBack') NOT NULL,
    `notes` TEXT NOT NULL,
    `reviewedById` VARCHAR(191) NOT NULL,
    `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PostImplementationReview_changeId_key`(`changeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NULL,
    `userName` VARCHAR(191) NOT NULL,
    `role` ENUM('requester', 'lineManager', 'deptHead', 'changeManager', 'cab', 'risk', 'implementer', 'exec', 'admin', 'superAdmin') NULL,
    `action` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `ref` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `meta` JSON NULL,

    INDEX `AuditLog_ref_idx`(`ref`),
    INDEX `AuditLog_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Department` ADD CONSTRAINT `Department_headId_fkey` FOREIGN KEY (`headId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Department` ADD CONSTRAINT `Department_lineManagerId_fkey` FOREIGN KEY (`lineManagerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowStage` ADD CONSTRAINT `WorkflowStage_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Change` ADD CONSTRAINT `Change_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `ChangeType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Change` ADD CONSTRAINT `Change_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Change` ADD CONSTRAINT `Change_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Change` ADD CONSTRAINT `Change_implementerId_fkey` FOREIGN KEY (`implementerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_changeId_fkey` FOREIGN KEY (`changeId`) REFERENCES `Change`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChecklistTask` ADD CONSTRAINT `ChecklistTask_changeId_fkey` FOREIGN KEY (`changeId`) REFERENCES `Change`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChecklistTask` ADD CONSTRAINT `ChecklistTask_doneById_fkey` FOREIGN KEY (`doneById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_changeId_fkey` FOREIGN KEY (`changeId`) REFERENCES `Change`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostImplementationReview` ADD CONSTRAINT `PostImplementationReview_changeId_fkey` FOREIGN KEY (`changeId`) REFERENCES `Change`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostImplementationReview` ADD CONSTRAINT `PostImplementationReview_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
