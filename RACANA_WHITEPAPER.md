# Racana — Product White Paper

**The 2-Minute Book Interior Publisher**
*Your manuscript in. Your finished book out.*

---

## 1. What Racana Is

Racana is a web application that converts a finished manuscript (Microsoft Word `.docx` or `.pdf`) into a **print-ready book interior PDF** — the file an author uploads to Amazon KDP or IngramSpark to print a physical book — plus a matching paperback cover and a Kindle-ready EPUB.

It is not a word processor, not an AI writer, not a marketplace, and not an ISBN service. It does one job end to end: manuscript in, professional book files out — in about two minutes, for a flat ₹2,450 (~$29) per interior.

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

Everything below is implemented, wired to real services, and verified by an automated test suite (112 tests across 21 files, all passing — including end-to-end tests that compile real PDFs through the production pipeline; TypeScript compiles with zero errors).

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

### 3.3 Book Styles (Templates)

Six curated publishing styles exist in the engine, each with its own Typst template, font stack, and layout rules. **Classic** and **Modern** are offered for new books at launch; the remaining four render for jobs that already carry them and return to the catalogue after their audit pass.

| # | Style | Personality | Body Font | Best for |
|---|---|---|---|---|
| I | **Classic** | Timeless Literary | EB Garamond | Novels, memoirs, history |
| II | **Modern** | Clean Minimal | Source Serif 4 / Source Sans 3 | Business, essays, modern nonfiction |
| III | **Philosophy** | Spacious Contemplative | Libre Baskerville | Contemplative writing, margin notes |
| IV | **Academic** | Structured Scholarly | Source Serif 4 | Research, technical, scholarly |
| V | **Literary** | Elegant Bookstore | Libre Baskerville | Fiction, distinctive literary voices |
| VI | **Indian Classical** | Traditional Ornamental | Noto Serif Devanagari/Tamil/Malayalam | Hindi, Tamil, Malayalam & Indian-language books |

All six templates are verified to render real PDFs with **embedded fonts** (no system fallbacks) — confirmed by the `render-fonts.test.ts` suite, which compiles each template and asserts the output contains no fallback glyphs. The template files are tracked in git (a regression test fails if they're ever un-tracked — a deployment can never silently lose them).

**Settings are overrides, not defaults.** Each template owns its typography; advanced settings are stored as nullable overrides on top. Choosing "Modern" produces Modern fonts, margins, and folios — an untouched settings form can never silently substitute Classic values.

### 3.4 Format & Specifications

**Simple mode (default, ~90% of authors):** pick a trim size.

| Trim | Use |
|---|---|
| 5″ × 8″ | Pocket paperbacks, fiction, poetry |
| 5.5″ × 8.5″ | Novels, memoirs, biographies |
| 6″ × 9″ | Standard publishing, non-fiction (default) |
| 8.5″ × 11″ | Textbooks, workbooks, large manuals |

**Advanced mode (collapsed by default):** inside gutter (mm), outside margin (mm), top/bottom margins, body & heading font family, font size (pt), line height, page-number placement, running headers on/off, recto chapter openings on/off, 0.125″ outer bleed on/off, colophon on/off. Margins below KDP's absolute floor (0.25″, or 0.375″ for the inside gutter) are rejected at the API.

**Bleed done right.** When bleed is on, the page is trim + 0.125″ on the outside edge plus 0.125″ top and bottom — the KDP spec exactly — and margins are compensated so the text block stays in the same place relative to trim. Bleed is fixed at 0.125″; any other value is ignored because KDP rejects it.

### 3.5 The Typesetting Engine

Racana uses **Typst** as its typesetting engine — a modern, ultra-fast, natively reproducible typesetting system.

The pipeline (`src/lib/queue/worker.ts` → `src/lib/renderer/publication-renderer.ts`):

1. **Manuscript analyzed** — the analyzer runs and persists `BookStructureV1`.
2. **Chapters detected** — the structure is verified to contain renderable content (≥50 chapter words or ≥200 chars of matter). A dedication-only booklet is refused with a clear message.
3. **Typography applied** — the chosen template + effective settings resolve to a Typst source document via `generateTypstSource()`.
4. **Layout generated** — the pinned Typst binary (`bin/typst`, v0.11.1) compiles the source to a PDF with the bundled open-license fonts.
5. **Images checked** — every declared image is verified to be embedded and decodable.
6. **Print QA** (`src/lib/renderer/qa.ts`) — a real preflight pass: PDF magic and size sanity, KDP's 24-page minimum, **inside gutter vs. KDP's page-count table** (a 400-page book needs 15.9 mm, not the 9.5 mm minimum), **physical page dimensions of every page** vs. the exact trim or trim+bleed geometry, **font embedding** (a non-embedded standard-14 font fails), extractable text per page, and minimum readable text.
7. **Signature padding** — the PDF is padded with genuinely blank pages to a multiple of 4 (never below KDP's 24-page floor) via `pdf-lib`.
8. **Previews** — per-page PNGs rendered for the in-app gallery.
9. **EPUB 3** — a validated ebook package is generated alongside the print file.
10. **Ready** — artifacts are uploaded to storage and job status flips to `ready` only after the artifact rows exist.

If any step fails, the job is marked `failed` with a human-readable `errorMessage` and the user is offered **Try Again** or **Upload a different file**.

**Typographic craft** — verified by tests that were proven to fail against the old engine:

- Chapters open on right-hand (recto) pages; blank filler pages inserted for parity are **truly blank** — no running head, no folio.
- Front-matter pages carry sequential lowercase roman folios (`i, ii, iii, v, vii…`) with no out-of-order restarts.
- Running heads alternate book title / chapter title, verso/recto.
- Small caps on chapter openers are synthesized (capitals at reduced height + tracking) for fonts without a true `smcp` feature.
- Typst's flow layout keeps at least two lines of a paragraph together at a page break — single-line widows/orphans cannot occur.
- Practice boxes, tables and block quotes split cleanly across pages.

The worker runs as a BullMQ consumer on a `book-processing` Redis queue, concurrency 2, either embedded in the Next.js server or as a dedicated esbuild-bundled process (`npm run build:worker` → `dist/worker.cjs`, Node ≥ 20.16). The dedicated worker exposes a `/health` endpoint that reports dependency state (503 while Redis is unreachable) and reconnects to Redis forever in production rather than dying on a dropped connection.

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

- `GET /api/health` — returns `{ ok, uptime, racana, postgres, redis }` for uptime monitoring; the dedicated worker exposes its own `/health` that reports dependency state.
- `GET /api/jobs/[id]` — full job state for the polling UI; `PATCH` saves settings (nullable style overrides) and invalidates stale cover/EPUB artifacts when a rendered book's interior-affecting settings change.
- `POST /api/jobs/[id]/start` — idempotent pipeline trigger; `{regenerate:true}` re-renders a finished book (free for 30 days after purchase).
- `GET /api/jobs/[id]/structure` — the analyzed `BookStructureV1`.
- `GET /api/jobs/[id]/preview/[page]` — a rendered preview PNG.
- `GET|POST /api/jobs/[id]/cover` — studio config/presets and validated cover artifact uploads.
- `GET /api/jobs/[id]/download` — interior PDF (watermarked preview or clean paid file).
- `GET /api/jobs/[id]/epub` — the EPUB package.
- `POST /api/events` — analytics ingestion (the client `track()` helper posts `upload_started`, `upload_success`, `template_chosen`, `book_ready`, `checkout_started`, `preview_downloaded`, `email_book_sent`, `share_created`, etc.).

### 3.13 The Marketing Site (`/`)

A single-page landing with: hero ("Your manuscript in. Your finished book out."), a before/after manuscript comparison, the six styles grid, the authorship promise ("Your words stay yours"), the craft/trim-size section, a $29 pricing block, a six-question FAQ, and JSON-LD `SoftwareApplication` structured data. Branded 404 and 500 pages, plus `/privacy` and `/terms`, are live.

### 3.14 Cover Page Studio (`/cover`)

An interactive, browser-based studio that produces print-ready paperback covers (back, spine, front) and 1:1.6 digital eBook covers without hiring an external designer:

- **Curated cultural presets:** Royal Saffron & Temple Gold, Peacock Indigo & Teal, Classic Obsidian, Sunset Terracotta, Minimalist Ivory, and Midnight Philosophy.
- **Cultural ornaments:** vector-rendered sacred Mandalas, Indian Lotuses, traditional Jharokha Arches, classical flourishes, geometric motifs.
- **Real-time SVG rendering** with print-production guides: bleed edge, trim line, safe zone, spine folds, and the KDP barcode area marked "keep clear."
- **KDP-accurate geometry:** spine width computed from the typeset interior's *real* page count and the chosen paper stock (cream `0.0025″`/page, white `0.002252″`/page) — never from whatever the browser posts. Trim + 0.125″ bleed panels, matching the interior.
- **Honest content:** nothing is invented — no default blurb, bio, ISBN, publisher, or tagline. Legacy placeholder values are stripped from saved designs and a stale browser carrying them is refused with a reload instruction. The barcode area stays empty for KDP's own barcode; an ISBN prints only when its check digit validates, and the studio warns when it doesn't.
- **Print-safety warnings, live:** an over-long blurb, a bio that would collide with the barcode area, spine text that can't fit, and an invalid ISBN are all flagged in the UI — nothing is silently truncated.
- **Fit-to-width typography:** long author names and spine text shrink to fit (or drop with a warning) instead of running off the trim.
- **Pixel-exact exports:** the browser rasterizes the preview SVG (with the cover fonts embedded as data URIs, including Indic families) at 300 DPI, embeds it in a correctly-sized PDF via `pdf-lib`, and uploads PDF + PNG + Kindle JPG under a size budget that respects host upload limits. Every upload is validated server-side — magic bytes, exactly one page, physical size matching the real trim + spine — before it's stored.
- **Paywall done properly:** the watermarked vector SVG stays free for design iteration; print-resolution exports unlock with purchase, enforced server-side.
- **Server-rendered fallback** (`src/lib/cover/pdf-fallback.ts`): when the client can't rasterize, the server renders the cover with the same bundled TTFs — including Devanagari, Tamil and Malayalam — rather than crashing or silently substituting standard-14 Times.

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
        │           3. resolve template + overrides → Typst source
        │           4. compile Typst → PDF (embedded fonts)
        │           5. verify embedded images
        │           6. print QA: page minimums, gutter table,
        │              per-page trim/bleed dims, font embedding, text
        │           7. pad to a 4-page signature (≥24 pages)
        │           8. persist interior PDF + previews + EPUB
        │           9. status = ready
        ▼
   /cover   ──►  design the wrap: spine sized from the real
                page count; validated upload saved to the job
        ▼
   /ready  ──►  download free preview (watermarked)
            ──►  or pay ₹2,450 via Razorpay (UPI/cards/netbanking)
                    ──►  signature verify/webhook flips Payment to "paid"
            ──►  download clean print-ready PDF + EPUB + cover files
            ──►  optional: email myself the book
            ──►  optional: mint a public share link
```

The whole flow from upload to a downloadable preview typically completes in under two minutes. The author never sees a margin number, a gutter calculation, a font name, or a PDF/X setting unless they choose to open the advanced panel.

---

## 5. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide icons |
| Database | PostgreSQL via Prisma ORM (migrate-deploy) |
| Object storage | S3-compatible (MinIO locally) + local-disk fallback |
| Queue & workers | BullMQ + Redis; dedicated worker = esbuild bundle (`dist/worker.cjs`), Node ≥ 20.16, `/health`, Redis reconnect-forever |
| Typesetting engine | Typst 0.11.1 (pinned binary in `bin/`, templates tracked in git) |
| PDF tooling | `pdf-lib` (padding, watermark, covers), `pdfjs-dist` (QA text extraction), `@pdf-lib/fontkit` + bundled TTFs (cover fallback) |
| DOCX parsing | `mammoth` + lenient OOXML fallback |
| Auth | Magic links (Resend) + Google OAuth + HMAC-signed guest sessions |
| Payments | Razorpay orders + signature verify + webhook |
| Email | Resend |
| Deployment | Docker Compose (dev); web + Fly worker + managed Postgres/Redis/S3 (prod) |

---

## 6. Quality Assurance

- **112 automated tests** across 21 files, all passing; TypeScript compiles clean.
- **End-to-end render tests** compile real manuscripts through the analyzer, Typst, signature padding, and pdfjs QA — asserting folio order, blank-page cleanliness, line pitch, and no font fallbacks.
- **Per-template font embedding test** renders all six templates and asserts each uses its intended font, embedded.
- **Regression tests were proven against the old code** — the folio-order, blank-page, and small-caps tests fail on the pre-fix engine, so they guard real behavior rather than passing vacuously.
- **Print QA tests** cover the KDP 24-page minimum, the page-count gutter table, bleed geometry (both enabled and disabled), all-page dimension checks, and non-embedded font rejection.
- **Cover tests** cover spine math, barcode-area clearance, placeholder stripping, ISBN validation, fit-to-width text, truncation warnings, the watermarked export, and the Indic-safe server fallback.
- **Templates-tracked test** fails if any `.typ` file is ever removed from git tracking.
- **Trust tests** cover the 30-day manuscript retention sweep and full job deletion.

---

## 7. What Racana Deliberately Does Not Do

These are locked non-goals, not gaps:

- No online word processor or collaborative editor — upload happens when the manuscript is finished.
- No AI that writes, rewrites, or summarizes the author's text.
- No ISBN assignment and no EAN barcode generation (an author-supplied valid ISBN-13 prints as text; the barcode area is left clear for KDP's own barcode).
- No print fulfillment or drop-shipping — the output is the file an author takes to KDP or IngramSpark.
- No marketplace of editors, proofreaders, or designers.

---

## 8. Pricing

| Tier | Price | Includes |
|---|---|---|
| Free Preview | $0 | Watermarked preview PDF of the typeset interior; full Cover Studio with watermarked vector exports |
| Pay-per-book | ₹2,450 (≈ $29) | Clean print-ready interior PDF, Kindle EPUB, print-resolution cover exports (PDF/PNG/JPG), all trim sizes, automated print QA, unlimited re-downloads, free re-generation for 30 days |

No subscription. No tier above $29 is sold today.

---

## 9. One-Line Summary

**Racana takes a finished manuscript and gives back a print-ready book interior — same words, professional form, two minutes, $29 flat.**
