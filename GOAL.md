GOAL
Build and ship V1 of “Manuscript In, Book Out” — a zero-technical-knowledge product that turns an uploaded DOCX/PDF manuscript into a print-ready interior PDF. I will not write or review code. You plan, implement, test in the browser, fix everything, document .env, and leave the app runnable.

NON-GOALS FOR ENTIRE PRODUCT (never build)
Online word processor, collab editing, 1000 templates, AI writing, cover generator, marketplace, ISBN, print fulfillment, Amazon KDP integration, complex author dashboard.

CORE PROMISE
“Upload your manuscript. Choose a style. We make the book.”
Users must never need to know margins, gutters, trim, fonts, widows/orphans, bleed, PDF/X.

STACK (LOCK THIS)
Next.js App Router + TypeScript + Tailwind + shadcn/ui
Prisma + Postgres
S3-compatible uploads (MinIO in docker-compose)
Auth: magic link email + Google OAuth stub
Stripe Checkout for paid download
Resend for email delivery
Background job queue (Inngest or BullMQ + Redis — pick one and use it everywhere)
Typesetting engine: choose Typst OR WeasyPrint and commit in README
AI via OPENAI_COMPATIBLE_BASE_URL + API key
Docker Compose for postgres, redis/minio, app
README with one-command local start

PART 1 SCOPE ONLY
1. Repo scaffold, docker-compose, Prisma schema, env example, seed.
2. Data model:
   User, BookJob, ManuscriptAsset, BookStructureJSON, TemplateChoice, BookSettings, RenderArtifact, QAReport, Payment, EmailLog.
   BookJob statuses: uploaded → analyzing → structure_ready → queued → typesetting → qa → fixing → ready | failed.
3. Marketing landing page:
   Headline: Your manuscript in. Your finished book out.
   Sub: Upload. Choose a style. Get a print-ready book.
   CTA: Upload your manuscript.
   Simple Free vs Pay-per-book vs later Pro. No subscription required for V1.
4. Auth: sign in / out, protected /app routes.
5. Full user journey UI (wire real routes, mock job progress if backend not ready yet):
   /upload
     - Drag-drop DOCX or PDF
     - Book type chips: Novel, Philosophy, Academic, Business, Memoir, Spiritual, Children's, Other
   /templates
     - Visual cards: Classic, Modern, Philosophy, Academic, Literary
     - Short personality line each (Timeless Literary / Clean Minimal / Spacious Contemplative / Structured Scholarly / Elegant Bookstore)
   /settings
     - SIMPLE MODE default: book type, template, trim size 5x8 / 5.5x8.5 / 6x9 / 8.5x11
     - Advanced collapsed: margins, font, size, leading, page numbers, running headers, chapter-open-recto, bleed. 90% never open this.
   /create → status screen with checklist:
     Manuscript analyzed, Chapters detected, Typography applied, Layout generated, Pagination optimized, Images checked, Print margins checked, Final PDF generated
   /ready → Download Print-Ready PDF + Email me the book
6. Upload API that stores file, creates BookJob, extracts page-count estimate, rejects empty/corrupt files. MVP limit 5–300 pages (enforce later if page count unknown).
7. Beautiful, calm, bookstore-quality UI. Mobile-friendly. No settings dump on first screen.
8. Tests: unit for upload validation; Playwright or browser agent walkthrough of landing → upload → type → template → simple settings → create → status → ready.
9. README: how to run, env vars, what Part 2 will plug into.

DONE WHEN
docker compose up works, landing + full click-through journey works in browser, DB persists jobs, files land in storage, you self-tested and fixed UI bugs. Then write ARTIFACTS/PART1_DONE.md with exact next-agent handoff.
Do not implement the typesetting engine or AI analyzer in Part 1 beyond stubs.


part 1 is complete check and confirm 

part 2

Continue the existing repo. Do not rewrite the stack. Read ARTIFACTS/PART1_DONE.md and the Prisma schema first. I will not write code. Implement, test, fix until done.

PART 2 SCOPE
Build Agent 1 (Manuscript Analyzer) and the template engine. Content integrity rule is absolute: FORMAT ONLY. Never rewrite author words. Never silently fix typos. You may FLAG possible typos in structure JSON only.

1. Document parser
   - DOCX: headings, paragraphs, quotes, lists, tables, footnotes, images+captions, page breaks, front/back matter heuristics
   - PDF: extract text + heading heuristics + embedded images (best-effort)
   - Unicode / Devanagari / Sanskrit must survive round-trip. Add a fixture manuscript snippet with Latin + Devanagari and assert no mojibake.

2. Book Structure Model (versioned JSON/AST stored on BookJob)
   Fields: title, subtitle, author, frontMatter[], chapters[{title, sections[], blocks[]}], backMatter[],
   block types: paragraph, heading_h1-h3, quote, list, table, footnote, image, caption, reference, bibliography
   Also: detected bookType suggestion, chapter count, estimated pages, warnings[].

3. After upload, job auto-runs analyze. UI after analysis:
   “We found N chapters, M sections, quotations…”
   User can continue to templates. Do not ask technical questions.

4. Template engine as DATA, not hardcoded layouts.
   Each template is a JSON config:
   Classic, Modern, Philosophy, Academic, Literary
   (optional aliases: Classic Philosophy, Modern Minimal)
   Config includes: trim, body font + size, leading, margins inside/outside/top/bottom, chapter starts on right-hand page, first-line indent vs paragraph spacing, quote indent, footer page numbers outer, running headers on/off, orphan/widow targets, bleed default 0 for interior-only V1.
   Fonts: embed open-license fonts only (e.g. EB Garamond, Source Serif, Libre Baskerville, Source Sans). Ship font files in repo.

5. Book settings merge: Simple mode writes template + trim + bookType. Advanced overrides merge on top. Persist on BookJob.

6. Optional mode radio stored but NOT executed in V1 besides format-only:
   ○ Formatting only (default, only implemented path)
   ○ Formatting + proofreading (disabled stub)
   ○ Formatting + editorial cleanup (disabled stub)

7. API: GET structure, PATCH settings, POST start-production (queues Part 3 job).
8. Tests with fixture DOCX: multi-chapter novel-like file + philosophy-like file with block quotes. Assert structure accuracy.
9. Update status checklist so “Manuscript analyzed” and “Chapters detected” become real.

DONE WHEN
Upload a fixture manuscript → analysis completes → structure JSON is correct → template + simple settings persist → start-production enqueues. Browser test passes. Write ARTIFACTS/PART2_DONE.md.
Do not generate final PDFs yet beyond a tiny debug preview if useful.


part 3 
Continue the existing repo. Read ARTIFACTS/PART3_DONE.md. I will not write code. Ship a complete V1.

PART 4 SCOPE
1. Monetization
   Free: upload + analysis + watermarked preview PDF (first N pages or diagonal watermark on all pages).
   Paid one-time per book: Stripe Checkout; after payment, unwatermarked print-ready PDF download unlocks. Store Payment on BookJob.
   Pricing: use env PRICE_CENTS (default 2900). No subscription in V1. Pro tiers are copy on landing only.

2. Email
   Resend: magic links already; also “email me the book” sends download link (auth-gated, paid if required).
   Job-ready email when production finishes.

3. Production hardening
   File size limits, virus-safe: only docx/pdf MIME + magic-byte check
   Job timeouts, retries, dead-letter status
   Rate limit uploads per user
   Structured logging
   Delete raw manuscripts option later — add retention env (default 30 days) and a cleanup job
   Health endpoint
   Legal pages: Privacy, Terms (simple)

4. Do not add: covers, EPUB, editable DOCX export, preflight PDF report beyond a simple “print checks passed” summary on the ready page. Those are V2.

5. Deploy
   Dockerfile + docker-compose.prod.yml
   Vercel-compatible next app + documented external worker if jobs can’t run on serverless
   If jobs need a long worker, provide a Fly.io or Railway worker service definition and a single deploy script.
   Seed demo account.

6. End-to-end browser test as a real user:
   Land → signup → upload fixture → choose Philosophy → Classic template → 6×9 → Create → wait until ready → see watermarked preview → Stripe test-mode checkout → download clean PDF → email link works.
   Use Stripe test keys. Agent must run this itself and fix failures.

7. README becomes a ship doc: env matrix, how to run fixture, how to deploy, architecture diagram in mermaid matching the product plan.

DONE WHEN
One command starts the stack, E2E passes, PDF is print-sized with embedded fonts, payments work in test mode, you recorded ARTIFACTS/SHIPPED.md with URLs, test credentials, and known limits (5–300 pages, format-only, interior PDF only).
Keep going until the browser path works. Do not stop on partial UI.



