-- CreateIndex
CREATE INDEX `AuditLog_category_at_idx` ON `AuditLog`(`category`, `at`);

-- CreateIndex
CREATE INDEX `AuditLog_role_at_idx` ON `AuditLog`(`role`, `at`);

-- CreateIndex
CREATE INDEX `Change_createdAt_idx` ON `Change`(`createdAt`);

-- CreateIndex
CREATE INDEX `Change_requesterId_status_idx` ON `Change`(`requesterId`, `status`);

-- CreateIndex
CREATE INDEX `Change_implementerId_status_idx` ON `Change`(`implementerId`, `status`);

-- CreateIndex
CREATE INDEX `User_status_idx` ON `User`(`status`);
