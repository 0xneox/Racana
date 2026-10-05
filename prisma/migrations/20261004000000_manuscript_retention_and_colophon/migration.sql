-- Manuscript retention sweep marker + opt-out colophon toggle.
ALTER TABLE "manuscript_assets" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "book_settings" ADD COLUMN "includeColophon" BOOLEAN NOT NULL DEFAULT true;
