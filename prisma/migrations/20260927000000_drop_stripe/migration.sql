-- Razorpay is now the only payment provider; drop the Stripe columns.
DROP INDEX IF EXISTS "payments_stripeSessionId_key";
DROP INDEX IF EXISTS "payments_stripePaymentIntentId_key";
ALTER TABLE "payments"
  DROP COLUMN IF EXISTS "stripeSessionId",
  DROP COLUMN IF EXISTS "stripePaymentIntentId";
ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'razorpay';
ALTER TABLE "payments" ALTER COLUMN "amountCents" SET DEFAULT 245000;
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'inr';
