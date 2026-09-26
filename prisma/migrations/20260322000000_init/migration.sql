-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('uploaded', 'analyzing', 'structure_ready', 'queued', 'typesetting', 'qa', 'fixing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "BookType" AS ENUM ('novel', 'philosophy', 'academic', 'business', 'memoir', 'spiritual', 'childrens', 'other');

-- CreateEnum
CREATE TYPE "TemplateKey" AS ENUM ('classic', 'modern', 'philosophy', 'academic', 'literary');

-- CreateEnum
CREATE TYPE "TrimSize" AS ENUM ('5x8', '5.5x8.5', '6x9', '8.5x11');

-- CreateEnum
CREATE TYPE "SettingsMode" AS ENUM ('format_only', 'format_proofread_stub', 'format_editorial_stub');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "contactEmail" TEXT,
    "shareToken" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'uploaded',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT NOT NULL DEFAULT 'uploaded',
    "bookType" "BookType" NOT NULL DEFAULT 'novel',
    "trimSize" "TrimSize" NOT NULL DEFAULT '6x9',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manuscript_assets" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "pageCountEstimate" INTEGER NOT NULL DEFAULT 1,
    "wordCountEstimate" INTEGER NOT NULL DEFAULT 0,
    "sha256Checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manuscript_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_structure_json" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "structureData" JSONB NOT NULL,
    "detectedTitle" TEXT,
    "detectedAuthor" TEXT,
    "chapterCount" INTEGER NOT NULL DEFAULT 0,
    "detectedBookType" "BookType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_structure_json_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_choices" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "templateKey" "TemplateKey" NOT NULL DEFAULT 'classic',
    "name" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_settings" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "trimSize" "TrimSize" NOT NULL DEFAULT '6x9',
    "fontBody" TEXT NOT NULL DEFAULT 'Garamond',
    "fontHeading" TEXT NOT NULL DEFAULT 'Cinzel',
    "fontSizePt" DOUBLE PRECISION NOT NULL DEFAULT 11.0,
    "lineHeight" DOUBLE PRECISION NOT NULL DEFAULT 1.35,
    "marginTopMm" DOUBLE PRECISION NOT NULL DEFAULT 19.05,
    "marginBottomMm" DOUBLE PRECISION NOT NULL DEFAULT 19.05,
    "marginInsideMm" DOUBLE PRECISION NOT NULL DEFAULT 22.22,
    "marginOutsideMm" DOUBLE PRECISION NOT NULL DEFAULT 15.87,
    "pageNumbers" TEXT NOT NULL DEFAULT 'bottom_center',
    "runningHeaders" BOOLEAN NOT NULL DEFAULT true,
    "chapterOpenRecto" BOOLEAN NOT NULL DEFAULT true,
    "bleed" BOOLEAN NOT NULL DEFAULT false,
    "bleedSizeMm" DOUBLE PRECISION NOT NULL DEFAULT 3.175,
    "mode" "SettingsMode" NOT NULL DEFAULT 'format_only',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_artifacts" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "downloadUrl" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "render_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_reports" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 100,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "jobId" TEXT,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "amountCents" INTEGER NOT NULL DEFAULT 2900,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT,
    "callbackUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "props" JSONB,
    "userId" TEXT,
    "guestId" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "resendMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "book_jobs_shareToken_key" ON "book_jobs"("shareToken");

-- CreateIndex
CREATE INDEX "book_jobs_userId_idx" ON "book_jobs"("userId");

-- CreateIndex
CREATE INDEX "book_jobs_guestId_idx" ON "book_jobs"("guestId");

-- CreateIndex
CREATE INDEX "book_jobs_status_idx" ON "book_jobs"("status");

-- CreateIndex
CREATE INDEX "book_jobs_createdAt_idx" ON "book_jobs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "manuscript_assets_jobId_key" ON "manuscript_assets"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "book_structure_json_jobId_key" ON "book_structure_json"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "template_choices_jobId_key" ON "template_choices"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "book_settings_jobId_key" ON "book_settings"("jobId");

-- CreateIndex
CREATE INDEX "render_artifacts_jobId_idx" ON "render_artifacts"("jobId");

-- CreateIndex
CREATE INDEX "qa_reports_jobId_idx" ON "qa_reports"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripeSessionId_key" ON "payments"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpayOrderId_key" ON "payments"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_jobId_idx" ON "payments"("jobId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "verification_tokens_identifier_idx" ON "verification_tokens"("identifier");

-- CreateIndex
CREATE INDEX "verification_tokens_expiresAt_idx" ON "verification_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "analytics_events_userId_idx" ON "analytics_events"("userId");

-- CreateIndex
CREATE INDEX "analytics_events_guestId_idx" ON "analytics_events"("guestId");

-- CreateIndex
CREATE INDEX "analytics_events_jobId_idx" ON "analytics_events"("jobId");

-- CreateIndex
CREATE INDEX "analytics_events_event_idx" ON "analytics_events"("event");

-- CreateIndex
CREATE INDEX "email_logs_jobId_idx" ON "email_logs"("jobId");

-- CreateIndex
CREATE INDEX "email_logs_recipientEmail_idx" ON "email_logs"("recipientEmail");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_jobs" ADD CONSTRAINT "book_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manuscript_assets" ADD CONSTRAINT "manuscript_assets_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "book_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_structure_json" ADD CONSTRAINT "book_structure_json_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "book_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_choices" ADD CONSTRAINT "template_choices_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "book_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_settings" ADD CONSTRAINT "book_settings_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "book_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_artifacts" ADD CONSTRAINT "render_artifacts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "book_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_reports" ADD CONSTRAINT "qa_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "book_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "book_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "book_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

