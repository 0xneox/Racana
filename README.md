# Racana — Manuscript In, Book Out

> **“Upload your manuscript. Choose a style. We make the book.”**
> A zero-technical-knowledge web application that turns an uploaded DOCX or PDF manuscript into a bookstore-grade, print-ready interior PDF — plus a matching paperback cover and Kindle EPUB.

---

## Core Promise & Non-Goals

- **Zero Technical Knowledge Required**: users never need to calculate margins, gutter compensation, spine width, fonts, bleed, or PDF/X conformance.
- **Strict Non-Goals**: no online word processor, no collaborative editing, no AI writing generators, no marketplace, no ISBN assignment or barcode generation, no print fulfillment.

---

## Architecture & Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Lucide icons
- **Database & ORM**: PostgreSQL via Prisma ORM (migrations in `prisma/migrations/`)
- **Object Storage**: S3-compatible storage (MinIO locally); local-disk fallback is development-only, production fails closed. The web and worker services must share S3 credentials and buckets.
- **Queue**: BullMQ + Redis; jobs run either embedded in the Next.js process or on a dedicated worker (`RACANA_EMBEDDED_WORKER=false` disables the embedded one)
- **Typesetting**: **Typst 0.11.1** (pinned binary in `bin/`), templates in `src/lib/renderer/typst/templates/` — **tracked in git**; a regression test fails if they're ever un-tracked
- **PDF tooling**: `pdf-lib` (padding, watermark, cover wrap), `pdfjs-dist` (text extraction for QA — **requires Node ≥ 20.16**), `@pdf-lib/fontkit` + bundled TTFs (server cover fallback)
- **Auth**: Email magic links (single-use, 15-min tokens via Resend) + Google OAuth when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set + HMAC-signed guest sessions
- **Payments**: Razorpay (₹2,450 per interior) — order, signature verify, and webhook paths

---

## Quickstart

### Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up --build
```

Services: web app `:3000`, Postgres `:5432` (db `manuscript_book_out`), Redis `:6379`, MinIO API `:9000`, MinIO console `:9001` (`minioadmin`/`minioadmin`).

### Local development

```bash
npm install
npx prisma generate
npm run dev          # http://localhost:3005
npm test             # vitest — ~112 tests, compiles real PDFs via bin/typst
npm run build:worker # bundle the queue worker to dist/worker.cjs
```

A local Postgres/S3 is optional for the test suite — tests fall back where possible.

Pull requests and pushes to `main` run the CI workflow with PostgreSQL migrations, typechecking, the full Vitest suite, and both production bundles.

---

## User Journey

1. **`/`** — landing page (out of scope of the typesetting audit).
2. **`/upload`** — `.docx`/`.pdf` up to 50 MB; magic-byte validation, page-count estimation, book-type chips.
3. **`/templates`** — style picker. Six styles exist in the engine; **Classic** and **Modern** are offered for new books at launch (the other four still render for existing jobs).
4. **`/settings`** — trim size (`5×8`, `5.5×8.5`, `6×9`, `8.5×11`) plus collapsed advanced controls. Advanced fields are **per-template overrides** (NULL = template default); switching template clears stale overrides. Changing settings on an already-rendered book triggers a re-render and invalidates stale cover/EPUB artifacts.
5. **`/create`** — live 8-step checklist while the worker typesets.
6. **`/cover`** — Cover Studio: presets, ornaments, palette, typography; live SVG preview with trim/bleed/spine/barcode guides; KDP-accurate spine width from the *real* interior page count; ISBN-13 check-digit validation; watermarked free exports, print exports unlocked by purchase.
7. **`/ready`** — verified spec card, watermarked free preview download, Razorpay checkout, clean PDF + EPUB after payment, email-my-book, share links.
8. **`/books`** — library dashboard with per-job status and deep links.

---

## The Render Pipeline (worker)

`src/lib/queue/worker.ts` → `src/lib/renderer/publication-renderer.ts`:

1. Analyze manuscript → `BookStructureV1`
2. Verify renderable content
3. Resolve template defaults + user overrides → Typst source
4. Compile with `bin/typst` and bundled open-license fonts
5. Verify embedded images
6. **Print QA** (`src/lib/renderer/qa.ts`): PDF magic, KDP 24-page minimum, page-count-dependent inside-gutter minimum, all-page physical dimensions vs. trim+bleed, font embedding, extractable text, minimum readable text
7. Pad to a multiple of 4 pages (signature alignment) — never below 24
8. Preview PNGs
9. EPUB 3 generation
10. Upload artifacts → `ready`

**Typographic craft** (verified by tests, not just claimed): chapters open on recto pages, running heads alternate title/chapter, front-matter roman folios stay in order, blank filler pages carry no headers/folios, small caps are synthesized for fonts without `smcp`, and Typst keeps ≥2 paragraph lines together at page breaks.

**Bleed** is fixed at KDP's 0.125″ on the outside edge + top/bottom; margins are compensated so the text block never moves. Other bleed values are ignored — KDP rejects them.

---

## The Cover Studio

- **Geometry**: `trim + 0.125″ bleed` panels + spine from the job's *rendered* page count (`qaReports.pageCount`) and chosen paper stock (cream 0.0025″/page, white 0.002252″/page). The browser-posted page count is never trusted.
- **Content hygiene**: no invented blurb/bio/ISBN/publisher is ever printed; legacy placeholder values are stripped from saved configs and rejected on save.
- **KDP barcode area**: bottom-right of the back cover stays clear; a valid ISBN-13 prints as text, an invalid one warns and is omitted.
- **Fit & warnings**: author/spine text shrink-to-fit or drop with a visible warning; blurb/bio truncation is flagged live in the studio.
- **Exports**: the browser rasterizes the preview SVG (fonts embedded as data URIs) → JPEG inside a correctly-sized PDF, plus PNG and Kindle JPG. Saves stay under a 3.8 MB budget for host upload limits. The server validates every upload (magic bytes, single page, physical size vs. real trim+spine).
- **Paywall**: print exports need a paid job; the free SVG is watermarked (`data-watermark`).
- **Server fallback** (`src/lib/cover/pdf-fallback.ts`): embeds the same bundled TTFs (incl. Devanagari/Tamil/Malayalam), used only when the client can't rasterize.

---

## Production Topology

| Piece | Where | Notes |
|---|---|---|
| Web app | Next.js (Dockerfile / Vercel) | `RACANA_EMBEDDED_WORKER=false` when a dedicated worker exists |
| Worker | Fly.io (`Dockerfile.worker`, `fly.toml`) | Runs `node dist/worker.cjs` (esbuild bundle, Node 20); `/health` returns 503 when Redis is down; 1 GB memory |
| Postgres | managed | `prisma migrate deploy` on release |
| Redis | managed | BullMQ; worker retries reconnects forever in production |
| S3 | managed | local-disk fallback in dev |

---

## Environment Variables

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection for BullMQ |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET_NAME` | Object storage |
| `STORAGE_FALLBACK_DIR` | Local disk folder if S3 is unreachable |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Auth base URL + session secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Payments |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email |
| `TYPESETTING_ENGINE` | `typst` (locked) |
| `RACANA_EMBEDDED_WORKER` | `false` on web when a dedicated worker runs |
| `OPENAI_COMPATIBLE_BASE_URL` / `OPENAI_API_KEY` | Optional LLM-enhanced structure detection |

---

## Deploy Checklist

1. `prisma migrate deploy` against production Postgres (includes the nullable-style-overrides migration).
2. Set all env vars above; set `RACANA_EMBEDDED_WORKER=false` on the web service.
3. Deploy the worker image (`Dockerfile.worker`) — it bundles `dist/worker.cjs`, Node 20, Typst binary, fonts and templates; the build fails loudly if templates are missing.
4. Configure `S3_ENDPOINT`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` on both web and worker services; production startup fails closed without them.
5. Confirm `GET /api/health` returns HTTP 200 (Postgres, Redis, and both S3 buckets ready) and the worker health endpoint reports ready before pointing users at it.
6. Commit state matters: the `.typ` templates must be pushed — fresh clones/deploys have no templates otherwise.
