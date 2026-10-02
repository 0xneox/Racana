# Racana — Product White Paper

**The 2-Minute Book Interior Publisher**
*Your manuscript in. Your finished book out.*

---

## 1. What Racana Is

Racana is a web application that converts a finished manuscript (Microsoft Word `.docx` or `.pdf`) into a **print-ready book interior PDF** — the file an author uploads to Amazon KDP or IngramSpark to print a physical book.

It is not a word processor, not a cover designer, not a marketplace, and not an ISBN service. It does exactly one thing: it typesets the interior pages of a book to professional print standards, in about two minutes, for a flat $29 per interior.

**The core promise, repeated on every page:** *Racana never rewrites, edits, or summarizes your manuscript. Your words go in. The same words come out — given a finished physical form.*

---

## 2. The Problem It Solves

Authors who finish a manuscript hit a wall before printing: the interior must conform to exact trim dimensions, gutter compensation, spine margins, running headers, recto chapter openings, folio placement, and font embedding. The tools that do this today are:

- **Adobe InDesign** — $599/year, 20+ hours of learning, overkill for a single book.
- **Reedsy Book Editor** — free but buggy typography, only 3 trim sizes, no Indian script typesetting.
- **Canva** — drag-and-drop text boxes, not real typesetting, no chapter detection.
- **Freelance Designers & Formatters** — $100–$500 per title and weeks of turnaround for covers and Kindle conversions.

Racana replaces that workflow with: **upload → choose a style → design cover in studio (optional) → download print-ready PDF + Kindle-ready EPUB**. Zero technical questions asked.

---

## 3. What Is Live and Working Now

Everything below is implemented, wired to real services, and verified by an automated test suite (34 tests across 8 files, all passing; TypeScript compiles with zero errors).

### 3.1 Manuscript Ingestion

- **Supported formats:** `.docx` (via `mammoth` with a lenient OOXML fallback for malformed files) and `.pdf` (via `pdf-parse`).
- **File limits:** up to 50 MB, 5–300 estimated pages.
- **Validation:** magic-byte checks, empty-file detection, page-count estimation, word-count estimation — all server-side before a job is created.
- **Storage:** S3-compatible object storage (MinIO in Docker Compose) with automatic local-disk fallback if S3 is unreachable. Every upload is checksummed (SHA-256) and recorded.
- **Rate limiting:** 15 uploads per hour per identity/IP. The 16th request returns `429 Too Many Requests`.

### 3.2 Manuscript Analysis

The analyzer (`src/lib/ai/analyzer.ts`, ~1,100 lines) parses the uploaded file into a structured `BookStructureV1` representation. It detects, without user input:

- **Title and author** from front matter and metadata.
- **Book type** (novel, philosophy, academic, business, memoir, spiritual, children's, other).
- **Front matter** and splits it into discrete typed entries: title page, copyright, epigraphs, preface, table of contents.
- **Chapters** and their sections — Preface and Contents are correctly excluded from the chapter list.
- **Block types** within chapters: paragraphs, ordered/unordered lists, tables, block quotes, practice boxes, table-of-contents entries with dot-leader layout.
- **Image references** embedded in the manuscript.
- **Script integrity warnings** — e.g. corrupted Devanagari text is flagged with a `corrupted_script` warning rather than silently rendered as tofu.

Title/author/type detection runs on a regex-first path; an OpenAI-compatible LLM endpoint is used to enhance detection only when `OPENAI_API_KEY` is configured. The product works without it.

### 3.3 Six Book Styles (Templates)

Six curated publishing styles, each with its own Typst template, font stack, and layout rules:

| # | Style | Personality | Body Font | Best for |
|---|---|---|---|---|
| I | **Classic** | Timeless Literary | EB Garamond | Novels, memoirs, history |
| II | **Modern** | Clean Minimal | Source Serif 4 / Source Sans 3 | Business, essays, modern nonfiction |
| III | **Philosophy** | Spacious Contemplative | Libre Baskerville | Contemplative writing, margin notes |
| IV | **Academic** | Structured Scholarly | Source Serif 4 | Research, technical, scholarly |
| V | **Literary** | Elegant Bookstore | Libre Baskerville | Fiction, distinctive literary voices |
| VI | **Indian Classical** | Traditional Ornamental | Noto Serif Devanagari/Tamil/Malayalam | Hindi, Tamil, Malayalam & Indian-language books |

All six templates are verified to render real PDFs with **embedded fonts** (no system fallbacks) — confirmed by the `render-fonts.test.ts` suite, which compiles each template and asserts the output contains no `Roboto`, `UbuntuMono`, or `LinLibertine` fallback glyphs.

### 3.4 Format & Specifications

**Simple mode (default, ~90% of authors):** pick a trim size.

| Trim | Use |
|---|---|
| 5″ × 8″ | Pocket paperbacks, fiction, poetry |
| 5.5″ × 8.5″ | Novels, memoirs, biographies |
| 6″ × 9″ | Standard publishing, non-fiction (default) |
| 8.5″ × 11″ | Textbooks, workbooks, large manuals |

**Advanced mode (collapsed by default):** inside gutter (mm), outside margin (mm), top/bottom margins, body & heading font family, font size (pt), line height, page-number placement, running headers on/off, recto chapter openings on/off, 0.125″ outer bleed on/off, colophon on/off.

### 3.5 The Typesetting Engine

Racana uses **Typst** as its typesetting engine — a modern, ultra-fast, natively reproducible typesetting system.

The pipeline (`src/lib/queue/worker.ts`):

1. **Manuscript analyzed** — the analyzer runs and persists `BookStructureV1`.
2. **Chapters detected** — the structure is verified to contain renderable content (≥50 chapter words or ≥200 chars of matter). A dedication-only booklet is refused with a clear message.
3. **Typography applied** — the chosen template + effective settings resolve to a Typst source document via `generateTypstSource()`.
4. **Layout generated** — the Typst binary (`bin/typst`) compiles the source to a PDF, with `--font-path` pointed at the bundled open-license fonts.
5. **Images checked** — every declared image is verified to be embedded and decodable.
6. **Trim & print checks** — a real QA pass (`src/lib/renderer/qa.ts`) verifies: PDF magic header, non-empty buffer, page count > 0, physical page size matches the chosen trim (±2pt tolerance), and extractable text length ≥ 50 chars (catches blank renders).
7. **Final PDF generated** — the interior PDF is uploaded to storage and a `RenderArtifact` row is written. A truncated preview source is also compiled to per-page PNGs (first 4 pages) for the in-app gallery.
8. **Book ready** — job status flips to `ready` only after the artifact exists.

If any step fails, the job is marked `failed` with a human-readable `errorMessage` and the user is offered **Try Again** or **Upload a different file**.

The worker runs as a BullMQ consumer on a `book-processing` Redis queue, started either embedded in the Next.js server (`instrumentation.ts`) or as a dedicated process (`scripts/worker.ts`). Concurrency is 2.

### 3.6 Free Preview vs. Paid Download

- **Free preview:** the same typeset interior, with a real diagonal watermark overlay (`RACANA · FREE PREVIEW`) applied via `pdf-lib`. The watermarked PDF is generated on-demand at download time.
- **Paid download:** when a `Payment` row exists with `status = "paid"`, the download endpoint serves the clean, unwatermarked PDF. The `X-Payment-Required` response header is set to `false` for paid jobs and `true` for previews.

The watermark is a genuine overlay, not a text tag — verified by `watermark.test.ts`.

### 3.7 Payment

- **Razorpay Checkout** (one-time ₹2,450 payment per interior, no subscription).
- `POST /api/checkout/razorpay` creates a Razorpay order scoped to the job owner (signed-in user or guest cookie). It refuses checkout if the job isn't `ready` or is already paid.
- `POST /api/checkout/razorpay/verify` verifies the checkout signature client→server and flips the `Payment` row to `paid`; `POST /api/webhooks/razorpay` does the same from Razorpay's `payment.captured` event.
- After payment, the user is redirected to `/ready?jobId=…&paid=1`, which polls the job every 3 seconds for up to 30 seconds to absorb the webhook race condition before showing "Payment confirmed."
- Rate limited: 20 checkout attempts per hour per IP.

### 3.8 Authentication

- **Magic-link email sign-in** — single-use, 15-minute, SHA-256-hashed tokens delivered via Resend. In dev without a Resend key, the sign-in API returns a `devLink` so the flow stays testable.
- **Google OAuth** — activates automatically when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set.
- **Guest mode** — users can upload, typeset, and pay without signing in. A guest cookie ties the job to their browser. The `/ready` page surfaces a "Save my book — sign in to keep this in your library" nudge.
- Sessions are HMAC-signed cookies.

### 3.9 The User Library (`/books`)

A dashboard listing every job owned by the current user (or guest). Each row shows status (Print-ready / In production / Needs attention / Analysis), the manuscript filename, the chosen template, and a deep link to the right step:
- `ready` → `/ready?jobId=`
- `failed` → `/create?jobId=` (retry)
- in production → `/create?jobId=`
- otherwise → `/templates?jobId=`

### 3.10 Sharing (the viral loop)

- `POST /api/jobs/[id]/share` mints a 24-char hex share token.
- `/s/[token]` is a public, server-rendered share page with dynamic OpenGraph metadata (title, description) and a dynamically generated OG image (`/s/[token]/opengraph-image`).
- Bot/crawler fetches are filtered by user-agent so view counts reflect real humans only.
- One-click share to X and WhatsApp, with copy-to-clipboard for the share URL.

### 3.11 Email Delivery

- `POST /api/email` sends the finished interior (with download link and printing instructions) to an email address the user enters on `/ready`.
- Delivered via Resend; failures are surfaced inline.

### 3.12 Operational Endpoints

- `GET /api/health` — returns `{ ok, uptime, racana, postgres, redis }` for uptime monitoring.
- `GET /api/jobs/[id]` — full job state for the polling UI.
- `POST /api/jobs/[id]/start` — re-trigger the pipeline after a failure.
- `GET /api/jobs/[id]/structure` — the analyzed `BookStructureV1`.
- `GET /api/jobs/[id]/preview/[page]` — a rendered preview PNG.
- `POST /api/events` — analytics ingestion (the client `track()` helper posts `upload_started`, `upload_success`, `template_chosen`, `book_ready`, `checkout_started`, `preview_downloaded`, `email_book_sent`, `share_created`, etc.).

### 3.13 The Marketing Site (`/`)

A single-page landing with: hero ("Your manuscript in. Your finished book out."), a before/after manuscript comparison, the six styles grid, the authorship promise ("Your words stay yours"), the craft/trim-size section, a $29 pricing block, a six-question FAQ, and JSON-LD `SoftwareApplication` structured data. Branded 404 and 500 pages, plus `/privacy` and `/terms`, are live.

### 3.14 Cover Page Studio (`/cover`)

An interactive, browser-based studio that allows authors to design print-ready paperback covers (back, spine, front) and 1:1.6 digital eBook covers without hiring an external designer:
- **Curated cultural presets:** Royal Saffron & Temple Gold, Peacock Indigo & Teal, Classic Obsidian, Sunset Terracotta, Minimalist Ivory, and Midnight Philosophy.
- **Cultural ornaments:** Vector-rendered sacred Mandalas, Indian Lotuses, traditional Jharokha Arches, and classical typography flourishes.
- **Real-time live SVG rendering:** 60fps instant visual feedback as the author fine-tunes typography, palettes, spine text, and back-cover blurbs.
- **Automated spine calculation:** Spine width is dynamically computed based on the book's verified page count and standard paper bulk.
- **Print & digital export:** Exports 300 DPI vector PDFs via `pdf-lib` and scalable SVGs, automatically saving artifacts to the job.

### 3.15 One-Click eBook & EPUB 3.0 Export

Instant generation of validated, reflowable digital book packages ready for immediate distribution:
- **Standard compliance:** Valid EPUB 3.0 package (`OEBPS/content.opf`, `OEBPS/nav.xhtml`) with EPUB 2 NCX (`OEBPS/toc.ncx`) for legacy Kindle compatibility.
- **Reflowable typography:** Embedded CSS tuned for Kindle Paperwhite, Kobo, Apple Books, and Google Play Books, with native font fallbacks for Devanagari, Bengali, Tamil, and Latin scripts.
- **Cover integration:** Automatically packages the designed cover artwork as the primary e-reader cover page.
- **Zero friction:** Available directly on `/ready` and `/books` with single-click download.

---

## 4. How It Works — End to End

```
Author uploads .docx/.pdf
        │
        ▼
   /api/upload  ──►  validate (magic bytes, size, pages)
        │            ──►  store to S3 (or local fallback)
        │            ──►  create BookJob + ManuscriptAsset + TemplateChoice + BookSettings
        │            ──►  enqueue "analyze" task on BullMQ
        ▼
   Worker: analyzeManuscript()  ──►  BookStructureV1 persisted
        ▼
   Author picks template  (/templates)
   Author picks trim size + optional advanced settings  (/settings)
        │
        ▼
   /create  ──►  Worker: processBookJob()
        │           1. analyze (if not already done)
        │           2. verify renderable content
        │           3. resolve template + settings → Typst source
        │           4. compile Typst → PDF (embedded fonts)
        │           5. verify embedded images
        │           6. QA: page count, trim size, extractable text
        │           7. persist interior PDF + preview PNGs to storage
        │           8. status = ready
        ▼
   /ready  ──►  download free preview (watermarked)
            ──►  or pay ₹2,450 via Razorpay (UPI/cards/netbanking)
                    ──►  signature verify/webhook flips Payment to "paid"
            ──►  download clean print-ready PDF
            ──►  optional: email myself the book
            ──►  optional: mint a public share link
```

The whole flow from upload to a downloadable preview typically completes in under two minutes. The author never sees a margin number, a gutter calculation, a font name, or a PDF/X setting unless they choose to open the advanced panel.

---

## 5. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide icons |
| Database | PostgreSQL 16 via Prisma ORM |
| Object storage | S3-compatible (MinIO in Docker Compose) + local-disk fallback |
| Queue & workers | BullMQ + Redis |
| Typesetting engine | Typst (bundled native binary, `bin/typst`) |
| PDF manipulation | `pdf-lib` (watermark, QA), `pdf-parse` (text extraction) |
| DOCX parsing | `mammoth` + lenient OOXML fallback |
| Auth | Magic links (Resend) + Google OAuth, HMAC-signed sessions |
| Payments | Razorpay orders + signature verify + webhook |
| Email | Resend |
| Containerization | Multi-container Docker Compose (postgres, redis, minio, app) |

---

## 6. Quality Assurance

- **34 automated tests** across 8 files, all passing.
- **TypeScript compiles with zero errors** (`tsc --noEmit` clean).
- **End-to-end render test** compiles a real manuscript (`root.pdf`) through the analyzer and Typst, asserting no system font fallbacks leak into the output.
- **Per-template font embedding test** renders all six templates and asserts each uses its intended font, embedded.
- **Watermark test** confirms the diagonal overlay is applied to previews and absent from paid PDFs.
- **Analyzer tests** verify front-matter splitting, chapter detection, practice-box detection, citation handling, control-character stripping, and corrupted-script warning behavior.
- **Validator tests** cover manuscript validation edge cases.

---

## 7. What Racana Deliberately Does Not Do

These are locked non-goals, not gaps:

- No online word processor or collaborative editor.
- No cover designer (referrals out to Canva / 1000covers).
- No ISBN assignment or barcode generation.
- No print fulfillment or drop-shipping.
- No marketplace of editors, proofreaders, or designers.
- No EPUB/MOBI export — print-ready PDF interior is the only export.

---

## 8. Pricing

| Tier | Price | Includes |
|---|---|---|
| Free Preview | $0 | Watermarked preview PDF of the typeset interior |
| Pay-per-book | $29 (≈ ₹2,450) | Clean, print-ready interior PDF, all six styles, all four trim sizes, automated QA, unlimited re-downloads, re-generation after manuscript corrections |

No subscription. No tier above $29 is sold today.

---

## 9. One-Line Summary

**Racana takes a finished manuscript and gives back a print-ready book interior — same words, professional form, two minutes, $29 flat.**
