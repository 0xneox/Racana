# Manuscript In, Book Out (V1)

> **“Upload your manuscript. Choose a style. We make the book.”**  
> A zero-technical-knowledge web application that turns an uploaded DOCX or PDF manuscript into a bookstore-grade, print-ready interior PDF.

---

## 🎯 Core Promise & Non-Goals

- **Zero Technical Knowledge Required**: Users never need to calculate margins, gutter compensation, spine trim, fonts, widows/orphans, outer bleed, or PDF/X conformance.
- **Strict Non-Goals**: No online word processor, no collaborative editing, no 1,000 bloated templates, no AI writing generators, no cover design tools, no marketplace, no ISBN, no fulfillment/print-on-demand drop-shipping.

---

## 🏗️ Architecture & Technology Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Lucide Icons + Bookstore Aesthetic
- **Database & ORM**: PostgreSQL 16 via Prisma ORM
- **Object Storage**: S3-compatible storage (MinIO in Docker Compose) with resilient local disk fallback
- **Queue & Background Jobs**: BullMQ + Redis for asynchronous 8-step pipeline progression
- **Typesetting Engine**: **Typst** (Locked & Committed). Ultra-fast compilation, native binding/recto-verso support, and reproducible PDF/X output
- **Authentication**: Email Magic Link stub + Google OAuth stub with session cookie management
- **Containerization**: Multi-container Docker Compose setup (`postgres`, `redis`, `minio`, `minio-create-buckets`, `app`)

---

## 🚀 Quickstart

### Option A: One-Command Start with Docker Compose (Recommended)

1. Clone the repository and copy the environment variables:
   ```bash
   cp .env.example .env
   ```

2. Start the entire application stack:
   ```bash
   docker compose up --build
   ```

3. Open your browser at [http://localhost:3000](http://localhost:3000).

Services started:
- **Next.js Web App**: `http://localhost:3000`
- **PostgreSQL**: `localhost:5432` (DB: `manuscript_book_out`)
- **Redis**: `localhost:6379`
- **MinIO API**: `http://localhost:9000`
- **MinIO Console**: `http://localhost:9001` (User: `minioadmin` / Pass: `minioadmin`)

---

### Option B: Local Standalone Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate Prisma Client:
   ```bash
   npx prisma generate
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Run the automated test suite:
   ```bash
   npm test
   ```

---

## 🗺️ User Journey Routes

1. **`/` (Marketing Landing Page)**
   - Bookstore-grade aesthetic with warm paper palette and serif typography.
   - Exact headline: *"Your manuscript in. Your finished book out."*
   - Exact subtitle: *"Upload. Choose a style. Get a print-ready book."*
   - Honest pricing: Free Preview ($0) vs Pay-per-book ($29) vs Pro ($79/mo waitlist).

2. **`/upload` (Step 1: Upload Manuscript)**
   - Drag-and-drop zone for `.docx` and `.pdf` manuscripts (up to 50MB).
   - Book type selector chips: `Novel`, `Philosophy`, `Academic`, `Business`, `Memoir`, `Spiritual`, `Children's`, `Other`.
   - Real-time client & server validation (magic bytes, empty file check, page count estimation).

3. **`/templates` (Step 2: Choose Personality)**
   - Visual specimen cards for 5 curated publishing styles:
     - **Classic**: *Timeless Literary* (Garamond, elegant drop caps, classic running headers)
     - **Modern**: *Clean Minimal* (Crisp sans/serif blend, generous whitespace, asymmetrical titles)
     - **Philosophy**: *Spacious Contemplative* (Wide margins, subtle section markers, refined proportion)
     - **Academic**: *Structured Scholarly* (Rigorous hierarchy, footnote-friendly, formal folios)
     - **Literary**: *Elegant Bookstore* (Deep typography, deckle-edge feel, poetic rhythm)

4. **`/settings` (Step 3: Format & Specifications)**
   - **Simple Mode (Default, 90% of authors)**: Selected style, book type, and physical trim size:
     - `5″ × 8″` (Pocket / Fiction / Poetry)
     - `5.5″ × 8.5″` (Trade Paperback / Memoirs)
     - `6″ × 9″` (Standard Publishing / Most Popular)
     - `8.5″ × 11″` (Manuals / Large Format)
   - **Advanced Controls (Collapsed by default)**: Inside gutter (mm), outside margin (mm), top/bottom margins, font family, font size, line height, running headers, recto chapter openings, and 0.125″ outer bleed.

5. **`/create` (Step 4: Real-time Typesetting Checklist)**
   - Live checklist tracking the 8 essential stages:
     1. Manuscript analyzed
     2. Chapters detected
     3. Typography applied
     4. Layout generated
     5. Pagination optimized
     6. Images checked
     7. Print margins checked
     8. Final PDF generated

6. **`/ready` (Step 5: Finished Book Download)**
   - Book specification card showing verified trim size, page count, and PDF/X compliance badge.
   - Primary Action: **Download Print-Ready PDF** (`/api/jobs/[id]/download`).
   - Secondary Action: **Email me the book** (logged to `EmailLog`).

---

## 🔑 Environment Variables (`.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/manuscript_book_out?schema=public` |
| `REDIS_URL` | Redis connection for BullMQ | `redis://localhost:6379` |
| `S3_ENDPOINT` | S3/MinIO API endpoint | `http://localhost:9000` |
| `S3_ACCESS_KEY` | MinIO root user / S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | MinIO root password / S3 secret key | `minioadmin` |
| `S3_BUCKET_NAME` | Primary manuscript bucket | `manuscripts` |
| `STORAGE_FALLBACK_DIR` | Local disk folder if S3 offline | `./storage` |
| `NEXTAUTH_URL` | Base URL for auth callbacks | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret key for session encryption | `development-secret-key-at-least-32-chars-long` |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments | `sk_test_...` |
| `RESEND_API_KEY` | Resend API key for transactional emails | `re_...` |
| `EMAIL_FROM` | Sender address for book deliveries | `books@manuscriptinbookout.com` |
| `TYPESETTING_ENGINE`| Committed typesetting engine | `typst` |
| `OPENAI_COMPATIBLE_BASE_URL` | LLM endpoint for structure parsing | `https://api.openai.com/v1` |
| `OPENAI_API_KEY` | API key for AI structure extraction | `sk-...` |

---

## 🔌 What Part 2 Will Plug Into

Part 1 sets the solid foundations, schemas, queue, storage, APIs, and UI. Part 2 will replace the stubs with production implementations:

1. **Typst Engine Core (`src/lib/typesetting/typst.ts`)**:
   - Compiles parsed manuscript structure (`BookStructureJSON`) into `.typ` markup.
   - Invokes the `typst compile` CLI to produce the physical PDF interior.
2. **AI Manuscript Analyzer (`src/lib/ai/analyzer.ts`)**:
   - Calls `OPENAI_COMPATIBLE_BASE_URL` to extract chapters, scene breaks, frontmatter, and headings from DOCX/PDF text.
3. **Stripe Checkout Webhook (`src/app/api/webhooks/stripe/route.ts`)**:
   - Receives `checkout.session.completed` events and marks `Payment.status = "paid"`.
4. **Resend Email Integration (`src/lib/email/resend.ts`)**:
   - Sends the PDF attachment or pre-signed S3 download link via Resend API.
