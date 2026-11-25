-- CreateEnum
CREATE TYPE "file_purpose" AS ENUM ('MENU_IMAGE', 'BRANDING', 'EXPENSE_ATTACHMENT', 'DOCUMENT');

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "purpose" "file_purpose" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");

-- CreateIndex
CREATE INDEX "stored_files_organization_id_purpose_created_at_idx" ON "stored_files"("organization_id", "purpose", "created_at");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sizes are positive and capped (the API enforces the real limit; this is a backstop).
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 52428800);
