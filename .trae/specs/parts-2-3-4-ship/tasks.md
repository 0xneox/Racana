# Manuscript In, Book Out - Parts 2/3/4 Implementation Plan

## Task 1: Install dependencies + ship open-license font files
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Install npm packages: mammoth (DOCX), pdf-parse (PDF text), stripe SDK, resend SDK, pdf-lib (for watermark/manipulation).
  - Create `public/fonts/` directory and place open-license font files: EB Garamond (Regular/Italic/Bold), Source Serif Pro, Libre Baskerville, Source Sans Pro, Noto Serif Devanagari (for Devanagari fixture). Prefer .ttf for Typst compatibility. Do NOT commit proprietary fonts.
  - Update package.json deployscripts as needed.
- **Acceptance Criteria Addressed**: FR-2.8 fontsEmbed; NFR-3 PDF Quality embedded font names match
- **Test Requirements**:
  - `rule` TR-1.1: `ls public/fonts/` lists 5+ font family files; each file is valid ttf/woff2 (non-zero bytes). Evidence: terminal ls output.
  - `rule` TR-1.2: `npm ls mammoth pdf-parse stripe resend` returns installed versions. Evidence: npm ls output.
- **Notes**: Read-first: [package.json](file:///home/binarybodhi/manuscript-in-book-out/package.json), [Dockerfile](file:///home/binarybodhi/manuscript-in-book-out/Dockerfile) to ensure fonts copied into runner stage.

## Task 2: Prisma schema updates + migrate
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None (bootstrap before analyzer/typesetting needs columns)
- **Description**:
  - Add `mode` field to `BookSettings` model: enum `SettingsMode` with values `format_only`, `format_proofread_stub`, `format_editorial_stub`; default `format_only`.
  - On `BookStructureJSON`: add `detectedBookType` (BookType enum) if not present; ensure schema handles `warnings` array in json.
  - On `Payment`: ensure `stripeSessionId` and `stripePaymentIntentId` exist (they do from part 1).
  - Run `npx prisma db push` dev-only (or add init container to compose for one-command).
  - Update `prisma/seed.ts` demo account `demo@manuscriptinbookout.com` (with or without magic-link bypass token documented).
- **Acceptance Criteria Addressed**: FR-2.10 mode stored; FR-4.4 demo seed documented
- **Test Requirements**:
  - `rule` TR-2.1: After db push, `BookSettings.mode` field writeable with `format_only`. Evidence: prisma client query log.
  - `rule` TR-2.2: Seed creates demo user row with expected email. Evidence: seed output + SELECT COUNT WHERE email='demo@manuscriptinbookout.com' = 1.
- **Notes**: Read-first: [prisma/schema.prisma](file:///home/binarybodhi/manuscript-in-book-out/prisma/schema.prisma), [prisma/seed.ts](file:///home/binarybodhi/manuscript-in-book-out/prisma/seed.ts)

## Task 3: DOCX/PDF parsers + Manuscript Analyzer module
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1 (mammoth/pdf-parse installed), Task 2 (schema ready for BookStructureJSON columns)
- **Description**:
  - Create `src/lib/manuscript/docx-parser.ts` using mammoth: extract paragraphs, headings (detect via style IDs "Heading 1..3" / outline levels), block quotes, lists, tables, footnotes, embedded images+captions (store image refs), explicit page breaks, front matter heuristics (text before first "Chapter" / "Book" heading).
  - Create `src/lib/manuscript/pdf-parser.ts` using pdf-parse (best-effort): extract raw text, heading heuristics based on font size / bold if metadata allows, embedded images if pdfjs-dist chosen.
  - Create `src/lib/ai/analyzer.ts`: orchestrator - if OPENAI_API_KEY set, send text chunks to OPENAI_COMPATIBLE_BASE_URL with structured JSON prompt; if no key, apply heading regex fallback.
  - Output shape strictly matches FR-2.4 BookStructureJSON schemaVersion=1 with all block types.
  - Warnings[] populate only (no rewrite) — optionally flag potential typos with regex.
  - Devanagari: ensure UTF-8 encoding preserved throughout Buffer -> mammoth extract -> JSON storage (no Buffer.toString with wrong encoding).
- **Acceptance Criteria Addressed**: AC-1 (novel fixture), AC-2 (Devanagari round-trip parse stage), FR-2.1..FR-2.5
- **Test Requirements**:
  - `rule` TR-3.1: `tests/analyzer.test.ts` novel_chapters.docx: chapterCount >= 3, quote blocks >= 1, list blocks >= 1, schemaVersion === 1. Evidence: npm test Analyzer.
  - `rule` TR-3.2: `tests/unicode.test.ts` philosophy_meditations.docx: raw extracted paragraph text.indexOf("ॐ नमः शिवाय") >= 0 (no U+FFFD in full text buffer). Evidence: npm test Unicode.
  - `rubric` TR-3.3: Heading level accuracy; scale 1-5; anchors 1=mixed all h1, 3=most correct, 5=h1/h2/h3 match doc intent; threshold >= 4. Evidence: reviewer manual spot-check on fixture output JSON headings vs document.
- **Notes**: Delegable as backend subagent. No user content rewrite ever.

## Task 4: Template JSON definitions + settings merge engine
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2 (BookSettings model mode confirmed)
- **Description**:
  - Create `src/lib/templates/definitions/` with 5 files: classic.json, modern.json, philosophy.json, academic.json, literary.json. Each has exact keys: key, displayName, personality, trimDefaults{trimSize, marginTopMm, marginBottomMm, marginInsideMm, marginOutsideMm}, body{fontFamily, fontSizePt, leadingEm, firstLineIndentMm, paragraphSpacingMm}, heading{fontFamily, h1SizePt, h2SizePt, h3SizePt, spacingBeforeMm, spacingAfterMm}, margins{insideMm, outsideMm, topMm, bottomMm}, layout{chapterOpenRecto bool, runningHeaders bool, runningHeaderFormat string, pageNumbersPosition string, orphanWidowTarget int, bleedMm float, bleedEnabled bool}, quote{indentLeftMm, indentRightMm, fontSizeAdjustEm, italic bool}, fontsEmbed[{family, file, weights[]}].
  - Create `src/lib/templates/engine.ts` exporting `getTemplate(key): TemplateDefinition` (loads JSON) and `getEffectiveSettings(templateDef, jobTrim, settingsRow)` performing 3-way merge (template defaults <- simple selections trim/template <- advanced overrides).
  - Register fontsEmbed paths relative to repo `public/fonts/`.
- **Acceptance Criteria Addressed**: AC-3 template JSON keys; AC-4 merge order; FR-2.7/2.9
- **Test Requirements**:
  - `rule` TR-4.1: `tests/templates.test.ts` loads 5 JSON files without throw; each has keys trimDefaults,body,heading,margins,layout,quote,fontsEmbed. Evidence: npm test Templates.
  - `rule` TR-4.2: `tests/settings.test.ts`: template fontSizePt=11, job trim=trim_6x9, settingsRow fontSizePt=12 => result.trimSize === trim_6x9, result.fontSizePt === 12, result.marginInsideMm === template.default.marginInsideMm (falls through). Evidence: npm test Settings.
- **Notes**: Use publisher-grade defaults: Classic = EB Garamond 11pt, leading 1.35em; Philosophy widest margins; Academic rigid footnote-friendly; Modern Source Sans blend; Literary Libre Baskerville deckle leading.

## Task 5: Create test fixtures (novel_chapters.docx + philosophy_meditations.docx)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None (can run parallel with Task 3)
- **Description**:
  - Generate `tests/fixtures/novel_chapters.docx`: 3+ chapters titled "Chapter 1: The Beginning", "Chapter 2: The Middle", etc., each with 3+ paragraphs, a blockquote, a numbered or bulleted list.
  - Generate `tests/fixtures/philosophy_meditations.docx`: 2 Books titled "Book I", "Book II", each with 3+ sub-chapter sections, many block quotes, paragraphs with Devanagari phrase "ॐ नमः शिवाय" embedded in a paragraph or inset footnote, at least 1 table (4x3).
  - Use mammoth CLI script or officegen to create real .docx ZIP packages with correct content types (PK magic bytes). Not empty.
- **Acceptance Criteria Addressed**: AC-1 and AC-2 fixture inputs; FR-2.12
- **Test Requirements**:
  - `rule` TR-5.1: Buffer first 4 bytes of novel fixture === `PK\\x03\\x04`; file size > 5KB. Evidence: node script assertion.
  - `rule` TR-5.2: Unzip philosophy fixture and verify word/document.xml contains Devanagari characters (UTF-8). Evidence: unzip + grep hex or string output.
- **Notes**: Use node script under tests/scripts/ to avoid binary bloat.

## Task 6: Typst typesetting engine module
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1 (font files shipped), Task 3 (structure output), Task 4 (effective settings)
- **Description**:
  - Create `src/lib/typesetting/typst.ts` with exported `async generateTypstPdf(structureData, effectiveSettings, templateDefn, outputDir, {watermarked=false, maxPages?}) -> {pdfPath: string, pageCount: number}`.
  - Build Typst source string:
    - `#set page(paper: "<trim>". e.g. "6in x 9in" OR custom size with +bleed if enabled; margin: (inside: Xmm, outside: Ymm, top: Zmm, bottom: Wmm))`
    - Font paths: `#font-path: ("public/fonts",)` (absolute path from cwd); reference families by name exactly as shipped.
    - Front matter: Half-title (structure.title centred large), Title Page (title, subtitle, author centred), Copyright stub.
    - For each chapter: if previous ended on recto AND chapterOpenRecto=true -> insert blank page first; apply heading style per template; paragraph blocks with firstLineIndent or paragraphSpacing; quote style italic+indent; lists and tables render; footnotes via Typst footnote syntax; images with captions.
    - Running headers (if runningHeaders=true): recto outer = book.title, verso outer = current chapter.title; use Typst header directive or page hooks.
    - Page numbers: #set page(numbering: "1", ..). Position: bottom_center or outer_header per settings.pageNumbers.
    - Orphan/widow: `#set par(orphan-control: true, widow-control: true)`; plus orphanWidowTarget int as loosen lines if Typst supports.
  - Write .typ to temp file, execFile("typst", ["compile", typInPath, pdfOutPath, "--root", projectRoot]) with strictly sanitized jobId in paths (no shell interpolation, no spaces, only [a-zA-Z0-9_-]).
  - For preview_pdf: if maxPages set, limit by truncating Typst content chapters OR apply watermark using pdf-lib: overlay low-opacity "PREVIEW" rotated 45 degrees across every page; AND truncate to first PREVIEW_PAGES (env, default 15) pages for smaller file.
  - Helper: `applyWatermark(srcPdfPath, dstPdfPath, text="PREVIEW")`.
- **Acceptance Criteria Addressed**: AC-5 real Typst 2-artifact generation; NFR-4 security (execFile no shell interpolation); FR-3.1..FR-3.7
- **Test Requirements**:
  - `rule` TR-6.1: `tests/typesetting.test.ts`: feed novel structure + classic/6x9 settings; generate both artifacts; interior_pdf size >= 50KB; MediaBox of page 1 parses as [0,0,432,648] (6x9 in pt) +/- 2pt; at least 1 font name in PDF embedded dict matches shipped font family string. Evidence: npm test Typesetting.
  - `rubric` TR-6.2: PDF page look; scale 1-5; 1=unreadable, 3=ok, 5=bookstore-pretty recto/chapter drop/spacing looks right; threshold >= 4. Evidence: reviewer opens PDF in viewer.
- **Notes**: Backend typesetting subagent. Handle Devanagari text: specify Noto Serif Devanagari as font for any block detected with Devanagari code points (or default Devanagari font).

## Task 7: Worker pipeline rewrite with real steps + auto-analysis
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3 (analyzer), Task 6 (typst engine), Task 4 (settings merge)
- **Description**:
  - Rewrite `src/lib/queue/worker.ts` `processBookJob()` so each CHECKLIST_STEPS entry runs real logic:
    1. `analyzing` / `Manuscript analyzed`: call analyzer (DOCX or PDF parser based on asset.mimeType) -> persist parsed BookStructureJSON upsert with schemaVersion, detectedTitle/Author, chapterCount, estimatedPages, warnings.
    2. `structure_ready` / `Chapters detected`: count chapters from stored JSON (ensure chapterCount == chapters.length, wordCount sum computed); update step text to real counts.
    3. `typesetting` / `Typography applied`: call getEffectiveSettings(template, trim, settings); validate fontsEmbed files exist on disk.
    4. `typesetting` / `Layout generated`: write Typst source with recto logic, running headers configured.
    5. `typesetting` / `Pagination optimized`: compile once, if orphan/widow flagged by QAReport rerun with looser lines or adjusted leading; keep best.
    6. `qa` / `Images checked`: extract images from structure; if local refs resolution <300dpi warn in QA issues.
    7. `fixing` / `Print margins checked`: run QA: parse PDF MediaBox/CropBox for trim match; detect any text bounding box within 0.125in of page edge -> issues[] entry. Generate QAReport row.
    8. `ready` / `Final PDF generated`: run generateTypstPdf() twice: once interior (clean), once preview (watermarked + N pages limit). S3 upload both via uploadToStorage with bucket "artifacts", keys `artifacts/<jobId>/interior_print_ready.pdf` and `preview_interior.pdf`. Create 2 RenderArtifact rows, set downloadUrl=`/api/jobs/${jobId}/download`.
  - Auto-analysis: after `/api/upload` creates BookJob, trigger analyzer inline (or add quick job to queue) before redirecting to `/templates`, so /create step 1 and 2 are already real by the time user reaches /create.
  - Apply job timeout: wrap processBookJob in Promise.race with setTimeout(JOB_TIMEOUT_MS) that updates job.status=failed with errorMessage "[Timeout] exceeded ${JOB_TIMEOUT_MS}ms".
- **Acceptance Criteria Addressed**: AC-5; AC-15 resilience (timeout path exists); FR-3.5
- **Test Requirements**:
  - `rule` TR-7.1: `tests/journey-v2.test.ts`: create DB job with real manuscript, run worker -> status=ready; 2 RenderArtifact rows exist; QAReport row exists with score >= 80. Evidence: npm test Journey-v2.
  - `rule` TR-7.2: `tests/resilience.test.ts`: mock Typst compile hangs with setTimeout, job.status transitions to failed within JOB_TIMEOUT_MS+10s; after BullMQ attempts >= 2, errorMessage begins "[DeadLetter]". Evidence: npm test Resilience.
- **Notes**: Core orchestration. Ensure in-process fallback still works if Redis offline.

## Task 8: Backend APIs: structure route, checkout sessions, Stripe webhook, health
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2 (schema), Task 4 (merge engine used), Task 7 (worker enqueue)
- **Description**:
  - `src/app/api/jobs/[id]/structure/route.ts` GET: return structure only if `BookStructureJSON` row exists and its `chapterCount>0`; else 404. If `?enrich=true` merge bookType suggestion, warnings count.
  - `src/app/api/checkout/sessions/route.ts` POST {jobId}: read PRICE_CENTS env(default 2900); use stripe SDK stripe.checkout.sessions.create({payment_method_types:["card"], line_items, mode:"payment", success_url: `${NEXT_PUBLIC_APP_URL}/ready?jobId={jobId}&paid=true`, cancel_url: `${NEXT_PUBLIC_APP_URL}/ready?jobId={jobId}&canceled=true`, metadata:{jobId}}). Create Payment row with stripeSessionId, status pending, amountCents, currency. Return {sessionId: session.id, url: session.url}.
  - `src/app/api/webhooks/stripe/route.ts` POST: raw body (not JSON parsed) for signature verification; construct event via stripe.webhooks.constructEvent(body, sigHeader, STRIPE_WEBHOOK_SECRET); on checkout.session.completed find Payment by stripeSessionId -> update status=paid + stripePaymentIntentId. Log to console + return 200. On signature fail -> 401.
  - `src/app/api/health/route.ts` GET: try prisma.$queryRaw`SELECT 1` (alive), Redis ping(), s3Client ListBuckets or HeadBucket; return JSON {ok, postgres, redis, s3, uptimeSec: process.uptime()}. 200 if ok=true else 503.
  - Enhance `src/app/api/jobs/[id]/download/route.ts`: query job.payments for any row status==="paid"; if yes serve interior_pdf else serve preview_pdf. Set Content-Disposition filename accordingly ("_preview_interior.pdf" vs "_interior_print_ready.pdf").
  - Enhance upload route: UPLOAD_MAX_BYTES env check (before parsing) return 413; add per-IP+per-user rate limiting with Redis ZADD expiry or in-memory LRU cache; 429 when exceeded.
- **Acceptance Criteria Addressed**: AC-6 download gating; AC-7 stripe endpoints; AC-9 hardening (file size, rate limit, health); FR-4.1, FR-4.3
- **Test Requirements**:
  - `rule` TR-8.1: `tests/stripe.test.ts` mocks stripe SDK: createCheckoutSession returns valid url; webhook sets Payment paid. Evidence: npm test Stripe.
  - `rule` TR-8.2: `tests/payments.test.ts`: unpaid GET /download -> preview artifact + filename "preview"; after Payment paid insert -> interior artifact filename "print_ready". Evidence: npm test Payments.
  - `rule` TR-8.3: `tests/hardening.test.ts`: upload 51MB payload -> 413; fake magic bytes -> 422; 11 rapid uploads same IP -> 11th 429 with Retry-After; GET /health returns JSON with postgres/redis/s3 fields. Evidence: npm test Hardening.
- **Notes**: Backend API subagent. Raw body for Stripe webhook requires Next.js config bodyParser false.

## Task 9: Resend integration (magic link auth callback + job-ready + email-me)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8 (health works after env changes), Task 2 (Payment schema needed for paid indicator in email)
- **Description**:
  - `src/lib/email/resend-client.ts`: Resend singleton with `async sendEmail({to, subject, html, attachments?})`; if RESEND_API_KEY missing/rejected -> log warning + fall back to stub EmailLog (never throw to user surface).
  - `src/app/api/auth/signin/route.ts` (create if not exists): POST {email, name?} -> create/upsert User row; generate random token `crypto.randomBytes(24).toString('hex')`, store token hash in `auth_tokens` temp table or new Prisma `AuthToken` model or short EmailLog. Send Resend email with magic link `$NEXTAUTH_URL/api/auth/callback?token=...` valid 15 min.
  - `src/app/api/auth/callback/route.ts` GET `?token=` -> verify token (expired? consumed?), look up user by attached email -> set session cookie via createSessionCookieValue; redirect to callbackUrl or /upload.
  - `src/lib/queue/worker.ts` when step status=ready reached: if job.userId and user.email -> Resend dispatch "Your book is ready" with pre-signed S3 download link for interior (if paid) OR preview link + checkout CTA in HTML body. Log EmailLog.
  - Upgrade `src/app/api/email/route.ts` existing: from stub -> call Resend client with book link(s); attach PDF or use pre-signed URL. EmailLog.resendMessageId = actual resend response.id (no resend_stub_ prefix).
- **Acceptance Criteria Addressed**: AC-8 Resend 3 flows; FR-4.2
- **Test Requirements**:
  - `rule` TR-9.1: `tests/email.test.ts` mocks Resend SDK: signin flow calls sendEmail with magic link; job-ready event calls sendEmail with download link; POST /api/email stores EmailLog.resendMessageId.startsWith NOT "resend_stub_". Evidence: npm test Email.
- **Notes**: Subagent backend. Google OAuth stub keeps existing; no additional scope.

## Task 10: Production hardening extras + legal pages
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 9 (rate limiter patterns already in place)
- **Description**:
  - Structured logger: new `src/lib/logger.ts` `log({level, component, msg, jobId?, userId?})` outputs JSON to stdout with timestamp ISO and level; use in upload, worker steps, payment, email, health.
  - Retry/dead-letter: `src/lib/queue/queue.ts` add attempts, backoff already in Part 1; ensure JobStatus.failed persists errorMessage "[DeadLetter]" after attempts exhausted via worker failure handler on('failed').
  - FILE_RETENTION_DAYS cleanup: new repeatable BullMQ job `every 24h` that deletes ManuscriptAssets where (job.status IN ("ready","failed") AND updatedAt < now() - retention days). Delete both S3 object + row (and associated Artifacts? No: keep artifacts per policy configurable later; default keep artifacts, delete raw manuscript sources only).
  - Legal pages: `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`: simple bookstore-appropriate content (no legal advice; standard: data collected=email+manuscripts, cookies session only, liability disclaimer, payments processed by Stripe, no warranty of merchantability for typeset output). Link in Footer component.
- **Acceptance Criteria Addressed**: AC-9 structured logs, retention, legal pages; FR-4.3 all.
- **Test Requirements**:
  - `rule` TR-10.1: curl `/privacy` and `/terms` return 200 HTML; Footer contains anchor links. Evidence: curl output.
  - `rule` TR-10.2: `logger.info({component:'test'})` JSON line contains timestamp, level, component keys. Evidence: stdout captured.
- **Notes**: Small but important polish.

## Task 11: Deploy artifacts: docker-compose.prod, Dockerfile.worker, fly.worker.toml, deploy.sh
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 7 (worker standalone entry needs to exist)
- **Description**:
  - `docker-compose.prod.yml`: override compose to add `worker` service separate from `app`, both run same base image different CMD; worker cmd `node src/worker-entry.js` (or ts-node equivalent if ts-node shipped, but better precompiled in standalone). No MinIO in prod; env vars `S3_ENDPOINT` empty forces real AWS S3. Secrets via env_file not inline.
  - Create `src/worker-entry.ts` (and compile step) that only imports `./lib/queue/worker` and keeps process alive with setInterval keepalive if BullMQ event loop doesn't.
  - `Dockerfile.worker` (or use target in existing Dockerfile): same base, CMD worker-entry.
  - `fly.worker.toml`: [app] name=mibo-worker, [build] dockerfile="./Dockerfile.worker", [env] DATABASE_URL, REDIS_URL, S3_ENDPOINT..., no services, [processes] worker command + auto_stop_machines=false.
  - `deploy.sh`: one-command `#!/usr/bin/env bash` that: (1) deploys web via `npx vercel --prod --yes` or `fly deploy --config fly.toml`; (2) deploys worker `fly deploy --config fly.worker.toml`; (3) prints URLs. Exit non-zero on any step fail.
  - `next.config.js` add `output: "standalone"` if not present already (already in Dockerfile appears standalone).
  - Update docker-compose dev: add init-container that runs `prisma db push && prisma db seed` before app starts so one-command start zero manual steps.
- **Acceptance Criteria Addressed**: AC-10 deploy artifacts present; NFR-6 one-command.
- **Test Requirements**:
  - `rule` TR-11.1: `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` validates with no errors; services list includes `worker`, `app`, `postgres`, `redis`. Evidence: docker compose config exit code.
  - `rule` TR-11.2: `bash deploy.sh --dry-run` (add flag) echoes the two deploy steps without executing; file exists and is executable. Evidence: ls -l + bash -n syntax check.
- **Notes**: Infrastructure task.

## Task 12: UI additions (analysis summary, payment CTA, mode radio, link to legal)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3 (structure real data needed for analysis card); Task 8 (checkout URL needed)
- **Description**:
  - Analysis summary: After upload redirects to /templates or new interstitial /structure-summary?jobId=...; card shows "We found N chapters, M sections, Q quotations." with subtitle "Your structure has been automatically detected." Continue CTA to /templates. If no analysis yet, poll until ready.
  - `/ready` page payment CTA block: if `Payment.status !== paid` for job, show "Unlock the full print-ready PDF for $29" with button "Pay with Stripe" that POSTs /api/checkout/sessions then window.location = data.url. If URL param paid=true show success toast.
  - `/settings` page add Mode radio group (above Advanced): three options "Formatting only" (checked default), "Formatting + Proofreading (Coming Soon - disabled)", "Formatting + Editorial cleanup (Coming Soon - disabled)". Store to BookSettings.mode via existing PATCH /api/jobs/[id] API (add mode param support in PATCH handler if not there).
  - Footer.tsx: add Privacy and Terms links to /privacy /terms.
  - Mobile 360x640 regression check: ensure all new cards don't overflow, buttons touch targets >= 44px.
- **Acceptance Criteria Addressed**: FR-2.6 post-analysis cue; FR-2.10 mode; AC-13 UI quality
- **Test Requirements**:
  - `rule` TR-12.1: On analysis summary page, structure JSON chapterCount matches DB; clicking Continue advances. Evidence: browser clicks.
  - `rule` TR-12.2: Mode radio POSTs to PATCH endpoint and updates BookSettings.mode. Evidence: DB row after submit.
  - `rubric` TR-12.3: UI quality per AC-13; scale 1-5; threshold >= 4. Evidence: reviewer 360px screenshots score.
- **Notes**: Frontend subagent. Reuse bookstore palette, serif fonts.

## Task 13: Write all unit/integration test suites + integrity test
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 3..12 produce modules
- **Description**:
  - Create missing test files: tests/analyzer.test.ts, tests/unicode.test.ts, tests/templates.test.ts, tests/settings.test.ts, tests/typesetting.test.ts, tests/payments.test.ts, tests/stripe.test.ts, tests/email.test.ts, tests/hardening.test.ts, tests/resilience.test.ts, tests/integrity.test.ts.
  - `tests/integrity.test.ts`: compare raw mammoth paragraph text vs BookStructureJSON.blocks[].text; whitespace-normalized equality for each paragraph. Count mismatches = 0 => pass. Any mismatch -> list diff + fail.
  - Update tests/journey.test.ts to use real worker pipeline (remove old 5/5 stub-only assertions or rename journey-v1).
- **Acceptance Criteria Addressed**: AC-1..AC-12 unit evidence; AC-14 integrity rubric; FR-2.12 fixture tests
- **Test Requirements**:
  - `rule` TR-13.1: `npm test` runs all suites and exits 0; total tests >= 30. Evidence: npm test summary line.
  - `rubric` TR-13.2: integrity.test.ts pass rate / paragraph matches; scale 1-5; threshold >= 4. Evidence: test output %match line.
- **Notes**: QA subagent. All tests via vitest (already in devDependencies).

## Task 14: E2E Playwright browser test setup + full Stripe checkout journey
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 8 (APIs), 9 (emails), 12 (UI flows), 13 (unit passing first)
- **Description**:
  - Install Playwright: `npm install --save-dev @playwright/test && npx playwright install chromium` (only chromium needed in CI). Add to package.json scripts `"test:e2e": "playwright test"`.
  - `tests/e2e/full-journey.spec.ts`: 16-step flow: 1) goto / expect headline; 2) if demo magic-link endpoint use it OR signin flow with demo user; 3) goto /upload, select Philosophy chip, upload fixture file (setInputFiles on dropzone input); 4) wait for structure summary N>0 chapters; 5) goto /templates select Classic card; 6) goto /settings select 6x9 trim, leave Format-only; 7) submit PATCH or "Create" button -> redirect /create?jobId=...; 8) wait for /create progress 100% or redirect to /ready within 120 seconds; 9) on /ready, click Download button initially, assert preview watermark (filename preview OR page count < 20); 10) click Stripe Pay button; 11) wait for Stripe checkout URL, fill test card 4242424242424242, any expiry future, any CVC/ZIP, submit; 12) wait redirect back /ready?paid=true toast visible; 13) click Download again, assert clean filename print_ready and size >= 50KB; 14) fill email form with test+e2e@example.com send; 15) wait email success status; 16) close browser.
  - If Stripe CLI needed for webhook delivery in test env: document to start `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in a parallel terminal; or in test mode call internal stripe mock webhook endpoint.
  - Keep total E2E runtime under 180s (timeout).
- **Acceptance Criteria Addressed**: AC-11 E2E; FR-4.5
- **Test Requirements**:
  - `rule` TR-14.1: `npm run test:e2e` exits 0; video or traces recorded on failure. Evidence: terminal exit + trace files.
- **Notes**: QA browser-agent subagent. Use Stripe test keys.

## Task 15: README rewritten as ship doc + env matrix + Mermaid diagram + ARTIFACTS
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 1..14 completed and verified passing
- **Description**:
  - Update [README.md](file:///home/binarybodhi/manuscript-in-book-out/README.md) to SHIP DOCUMENT:
    - Keep existing quickstart, extend with (a) Mermaid architecture diagram (sequence or C4 style: Upload -> Analyzer -> Queue -> Typst Worker -> Stripe -> Resend -> User; plus boxes: Postgres, Redis, S3 Storage).
    - Section "Environment Matrix" table: Variable | Dev default | Docker default | Prod | Required?; include PRICE_CENTS, PREVIEW_PAGES, FILE_RETENTION_DAYS, JOB_TIMEOUT_MS, UPLOAD_MAX_BYTES, STRIPE keys, RESEND keys, OPENAI keys.
    - Section "Fixture Upload Walkthrough": step-by-step upload philosophy_meditations.docx through ready.
    - Section "How to Deploy": Vercel (Next standalone) + Fly.io worker (fly.worker.toml + deploy.sh); document Vercel limitation: long-running jobs MUST use external worker, Vercel API routes are serverless max ~60s so analysis+typesetting never inside Vercel, always delegated to BullMQ worker separate service.
    - Section "Known Limits" callout box: 5-300 pages limit (reject early at validator), Format-only (no proofread/editorial executed), Interior PDF only (no covers/EPUB).
  - Create `ARTIFACTS/PART2_DONE.md`: describe Analyzer + Template Engine handoff, what was built, entrypoints.
  - Create `ARTIFACTS/PART3_DONE.md`: describe Typst engine + worker real steps.
  - Create `ARTIFACTS/SHIPPED.md`: summary V1 shipped URLs (localhost:3000), test credentials demo@manuscriptinbookout.com (magic link auth method), Stripe test card numbers for QA, Resend sandbox notes, known issues list (limits above).
- **Acceptance Criteria Addressed**: AC-12 README sections; FR-4.6 spec
- **Test Requirements**:
  - `rule` TR-15.1: `grep -c "mermaid\|graph " README.md` >= 1 diagram block; grep count env matrix rows >= 15 vars; grep "Fixture Upload Walkthrough" 1 match; grep "Known Limits" 1 match. Evidence: grep outputs.
  - `rule` TR-15.2: ARTIFACTS directory contains PART2_DONE.md, PART3_DONE.md, SHIPPED.md. Evidence: ls output.
- **Notes**: Documentation + handoff task.

## Task 16: Final integration verification + diagnostics run
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1..15
- **Description**:
  - Fresh start: `docker compose down -v && docker compose up --build -d && sleep 45 && ./deploy.sh --dry-run`
  - `npm test` (vitest all suites) -> capture summary line.
  - `npm run test:e2e` -> capture exit, save trace.
  - `curl -s http://localhost:3000/api/health` confirm ok:true.
  - `curl -s -o /tmp/sample.pdf -w "%{http_code}" -X POST -F "file=@tests/fixtures/novel_chapters.docx" -F "bookType=novel" http://localhost:3000/api/upload | grep 200` -> poll structure endpoint -> then start production -> poll ready -> download preview -> compare sizes.
  - Fix any failures discovered; iterate until all TR/AC pass.
- **Acceptance Criteria Addressed**: AC-12 one-command; AC-11 E2E; AC-1 through AC-15
- **Test Requirements**:
  - `rule` TR-16.1: `npm test` exit 0; `npm run test:e2e` exit 0; health endpoint 200 ok.
  - `rubric` TR-16.2: end-to-end manual feel; 1-5; 1=broken flow, 3=works but rough edges, 5=smooth bookstore flow all buttons behave no console errors; threshold >= 4.
- **Notes**: Final QA. Iterate fixes back into earlier tasks if needed.
