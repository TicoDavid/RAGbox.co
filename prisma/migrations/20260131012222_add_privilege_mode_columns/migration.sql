-- DropIndex
DROP INDEX "idx_document_chunks_embedding";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "privilege_mode_changed_at" TIMESTAMP(3),
ADD COLUMN     "privilege_mode_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "referrer" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_email_key" ON "waitlist_entries"("email");
