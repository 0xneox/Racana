# Manuscript In, Book Out - Parts 2/3/4 Combined Ship Spec

## Overview
- **Summary**: Ship production V1 by replacing all Part 1 stubs with real implementations: DOCX/PDF parser + AI structure analyzer, Typst typesetting engine with template JSON configs and embedded open-license fonts, Stripe Checkout monetization with watermarked free preview, Resend email delivery (magic link + job-ready + email-me), production hardening (timeouts, retries, rate limits, MIME+magic-byte, retention cleanup, health endpoint, legal pages), Docker prod compose + Vercel-compatible app + standalone worker, and full E2E browser journey including Stripe test mode checkout.
- **Purpose**: Deliver a runnable V1 where a real user uploads DOCX -> real analysis detects chapters -> Typst produces trim-sized PDF -> Stripe unlocks clean download -> Resend emails the link.
- **Target Users**: Zero-technical authors wanting bookstore-grade interiors.

## Goals
1. Part 2 (Analyzer + Template Engine): Replace stub chapter data with real DOCX/PDF parsing + AI-assisted extraction. Templates as JSON data. Ship open-license fonts.
2. Part 3 (Typesetting Engine): Replace createSampleInteriorPdf() stub with real Typst rendering consuming BookStructureJSON + BookSettings + TemplateChoice, outputting trim-sized PDF with embedded fonts, recto openings, running headers, gutters, orphan/widow. Generate watermarked preview.
3. Part 4 (Monetization+Email+Hardening+Deploy+E2E): Gate download (free=watermarked), integrate Resend emails, harden endpoints, ship Docker prod + Vercel/worker deploy, pass full browser E2E incl Stripe test checkout.

## Non-Goals
- Cover gen, EPUB, editable DOCX (V2)
- AI writing, proofread execution, editorial execution (latter 2 stored-only stubs)
- Dashboard, ISBN, fulfillment, marketplace, KDP
- Any rewrite of author words (FORMAT ONLY); typos only in warnings[]

## Background & Context
- Part 1 COMPLETE (ARTIFACTS/PART1_DONE.md): Next14+TS+Tailwind, Prisma 10 models (User,BookJob,ManuscriptAsset,BookStructureJSON,TemplateChoice,BookSettings,RenderArtifact,QAReport,Payment,EmailLog), BullMQ+Redis, MinIO S3 w local fallback, 6 UI pages, worker iterates 8 steps but stub-structure JSON + 1-page PDF, docker-compose + Dockerfile Typst binary installed, validator tests pass.
- Locked Stack: Next.js App Router+TS+Tailwind+shadcn-ready; Prisma+Postgres; S3-compatible(MinIO); magic-link+Google stub; Stripe Checkout; Resend; BullMQ+Redis; **Typst**; OPENAI_COMPATIBLE_BASE_URL; Docker Compose.
- Content Integrity absolute: FORMAT ONLY. No rewrite. No silent typo fix. Flag in warnings[] only if implemented.
- Unicode/Devanagari/Sanskrit must survive round-trip. Fixture: Latin + Devanagari, no mojibake.

## Functional Requirements

### Part 2 FR
FR-2.1 DOCX Parser: headings(h1-h3 via style/outline), paragraphs, quotes, lists, tables, footnotes, images+captions, page breaks, front/back heuristics.
FR-2.2 PDF Parser (best-effort): raw text, heading heuristics(font size+bold), embedded images.
FR-2.3 Unicode: Latin+Devanagari fixture -> extract -> store -> render all match (no mojibake, no U+FFFD).
FR-2.4 BookStructureJSON schemaVersion: {schemaVersion:1,title,subtitle,author,detectedBookType,chapterCount,estimatedPages,warnings:[{code,level,message,page?}], frontMatter:[{type,title,blocks[]}], chapters:[{number,title,wordCount,sections:[{title,blocks[]}]}], backMatter:[{type,title,blocks[]}]}; block types: paragraph,heading_h1..h3,quote,list_ordered,list_unordered,table,footnote,image,caption,reference,bibliography.
FR-2.5 Auto-analysis: after /upload POST, queue/inline analyzer so /create steps 1+2 reflect real chapterCount.
FR-2.6 Post-analysis cue: "We found N chapters, M sections, Q quotations" summary card with continue CTA (no technical questions).
FR-2.7 Templates as JSON: 5 files classic/modern/philosophy/academic/literary.json with trimDefaults,body,heading,margins,layout,quote,fontsEmbed[].
FR-2.8 Fonts shipped: public/fonts/ EB Garamond, Source Serif Pro, Libre Baskerville, Source Sans Pro, Noto Serif Devanagari (.ttf/.woff2). Typst uses local fonts only.
FR-2.9 Settings merge: templateDefaults <- simpleSelections(bookType, templateKey, trimSize) <- advancedOverrides; persist to BookSettings.
FR-2.10 Mode radio: BookSettings.mode in {format_only, format_proofread_stub, format_editorial_stub}; only format_only executes; others "Coming soon" badge + fallback behavior.
FR-2.11 APIs: GET /api/jobs/[id]/structure (404 if not ready); PATCH /api/jobs/[id] accepts mode + merge; POST /api/jobs/[id]/start-production (alias start route, enqueue real typesetting).
FR-2.12 Fixtures: tests/fixtures/novel_chapters.docx (multi-chapter, h1/h2, quotes, lists); tests/fixtures/philosophy_meditations.docx (book titles, block quotes, Devanagari inset). Tests assert structure accuracy, no mojibake.

### Part 3 FR
FR-3.1 Typst generator pipeline: replaces JobStatus.ready->createSampleInteriorPdf() with generateTypstPdf(structure, effectiveSettings, templateDefn) -> #set page(paper, margins: inside/outside/top/bottom mm->in->pt); local font path defs; front matter; chapters with recto-open insert blank verso; block styling per template; alternating recto book title/verso chapter title running headers; page numbers bottom_center or outer_header; orphan/widow; embed all fonts.
FR-3.2 Free preview: preview_pdf artifact (PREVIEW watermark 45deg low-opacity on every page, AND/OR first N=15 pages default env PREVIEW_PAGES).
FR-3.3 Clean paid artifact: interior_pdf artifact all pages no watermark.
FR-3.4 Trim mapping: 5x8=127x203.2mm; 5.5x8.5=139.7x215.9mm; 6x9=152.4x228.6mm; 8.5x11=215.9x279.4mm. If bleed:true, +3.175mm all sides.
FR-3.5 Worker real steps: 3.Typography (settings+fonts validated); 4.Layout (.typ written, recto, headers); 5.Pagination (orphan/widow pass); 6.Images (DPI warn); 7.Margins QA; 8.PDF compiled + S3 upload both artifacts.
FR-3.6 Artifact persistence: 2 RenderArtifact rows interior_pdf + preview_pdf.
FR-3.7 QAReport real: PDF opens/pages>1, fonts embedded heuristic, trim matches MediaBox +/-2pt, no content in trim-danger +/-0.125in; issues[] JSON populated; score 0-100, passed:true if no critical.

### Part 4 FR
FR-4.1 Stripe: POST /api/checkout/sessions {jobId} -> line_items PRICE_CENTS default 2900 USD success_url /ready?jobId paid=true cancel_url canceled=true; POST /api/webhooks/stripe signature-verified checkout.session.completed sets Payment.status=paid + paymentIntentId; GET /api/jobs/[id]/download checks job.payments any paid===true -> interior_pdf else preview_pdf; UI shows "Upgrade to clean version" CTA on unpaid.
FR-4.2 Resend: magic-link POST /api/auth/signin dispatches real Resend with 15min tokenized link; worker ready event emails job.user.email with pre-signed link; POST /api/email existing endpoint upgraded: Resend dispatch, paid status reflected; EMAIL_FROM env; EmailLog real resendMessageId.
FR-4.3 Hardening: UPLOAD_MAX_BYTES default 50MB enforced; MIME+magic-byte (PDF: %PDF- + application/pdf; DOCX: PK\\x03\\x04 + vnd.openxmlformats-officedocument.wordprocessingml.document) BOTH enforced 422 otherwise; JOB_TIMEOUT_MS 15min + attempts=2 exp backoff; dead-letter marked errorMessage "[DeadLetter]"; rate limit upload per-IP 10/10min per-user 20/day Redis-backed or LRU; structured JSON logs {timestamp,level,component,msg,jobId?,userId?}; FILE_RETENTION_DAYS default 30 daily repeatable cleanup BullMQ job deletes terminal assets>30d; GET /api/health {ok, postgres, redis, s3, uptimeSec} 200/503; /privacy + /terms static simple pages.
FR-4.4 Deploy: docker-compose.prod.yml separate services no inline secrets app+worker+postgres+redis no minio (expect real S3 env); next.config output=standalone; Vercel serverless limitation documented: long-jobs/worker REQUIRED external; Fly.io fly.worker.toml + Dockerfile.worker + deploy.sh single-script web+worker; seed demo demo@manuscriptinbookout.com documented creds ARTIFACTS/SHIPPED.md.
FR-4.5 E2E Browser Test: Land -> Sign in demo -> Upload philosophy fixture -> Classic template -> 6x9 trim -> Create -> Wait ready (max 120s) -> Download preview watermark confirmed -> Stripe checkout test 4242424242424242 -> /ready paid=true -> Download clean PDF full pages no watermark -> Email-me creates non-stub EmailLog.
FR-4.6 README ship doc: Mermaid arch diagram; env matrix dev/prod/docker; fixture run steps; deploy (Vercel+Fly worker); known limits 5-300 pages format-only interior PDF only.

## Non-Functional Requirements
NFR-1 Perf: DOCX <1MB -> analysis + structure <10s (regex fallback if no LLM key)
NFR-2 Rel: Upload 200 files no DB/storage corruption; retries <=2 per job
NFR-3 PDF Quality: trim physical size matches Acrobat; fonts embedded show open-license names
NFR-4 Security: no user input in shell commands; execFile Typst args strictly sanitized jobId [a-zA-Z0-9_-] only
NFR-5 Mobile: privacy,terms,analysis-summary no overflow 360x640
NFR-6 One-command start: docker compose up --build starts full stack auto-prisma push/seed via init container

## Constraints
- Technical Locked Stack (no deviations): Next+TS+Tailwind; Prisma+Postgres; MinIO/S3; BullMQ+Redis; Typst; Stripe; Resend; OPENAI_COMPATIBLE; Docker Compose
- Business: $29 default env PRICE_CENTS; no subscriptions V1; Pro tiers landing copy only
- Dependencies: mammoth DOCX; pdf-parse/pdfjs-dist PDF text; stripe SDK; resend SDK; typst binary (Dockerfile); open-license fonts

## Assumptions
(a) Stripe test keys from .env; if missing: checkout flow stubbed but UI works mock-success
(b) Resend key from env; if missing: EmailLog stub warning log, UX never breaks
(c) OPENAI key optional; if not set: analyzer uses heading-regex DOCX fallback, no AI enrichment
(d) Devanagari: Noto Serif Devanagari in repo + Typst source; standard runs no complex shaping edge cases
(e) Defaults per "simpler publisher-grade": Classic template, 6x9 trim

## Acceptance Criteria

### AC-1: DOCX Parser extracts full structure correctly
- **Type**: `rule`
- **Given**: Upload novel_chapters.docx fixture, analysis completes
- **When**: GET /api/jobs/[id]/structure
- **Then**: chapterCount >= 3, chapters titles match fixture h1 strings, at least one quote block + one list block, schemaVersion===1
- **Pass Condition**: tests/analyzer.test.ts novel + philosophy fixture assertions pass
- **Evidence**: npm test Analyzer suite output

### AC-2: Devanagari round-trip survives no mojibake
- **Type**: `rule`
- **Given**: Philosophy fixture contains "ॐ नमः शिवाय" Devanagari phrase
- **When**: Extract structure -> render Typst PDF -> extract text via pdf-parse
- **Then**: Extracted text contains original Devanagari code points (no U+FFFD replacement chars)
- **Pass Condition**: tests/unicode.test.ts assertions
- **Evidence**: npm test Unicode suite output

### AC-3: Templates are JSON data with required keys
- **Type**: `rule`
- **Given**: src/lib/templates/definitions/ directory
- **When**: Enumerate JSON files
- **Then**: 5 files (classic/modern/philosophy/academic/literary.json), each parsable, each has trimDefaults,body,heading,margins,layout,quote,fontsEmbed[]
- **Pass Condition**: tests/templates.test.ts loads & validates keys without throw
- **Evidence**: npm test Templates suite output

### AC-4: 3-way settings merge order correct
- **Type**: `rule`
- **Given**: Template default fontSizePt=11, user selects trim 6x9, user sets advanced fontSizePt=12
- **When**: getEffectiveSettings(template, jobTrim, settingsRow) called
- **Then**: trimSize===trim_6x9, fontSizePt===12, other margins=template defaults
- **Pass Condition**: tests/settings.test.ts merge assertions
- **Evidence**: npm test Settings suite output

### AC-5: Worker produces real Typst-rendered 2 artifacts
- **Type**: `rule`
- **Given**: BookJob with valid BookStructureJSON (10+ chapters)
- **When**: processBookJob(jobId) reaches JobStatus.ready
- **Then**: (a) 2 RenderArtifact rows (interior_pdf + preview_pdf); (b) interior_pdf bytes >= 50KB; (c) PDF MediaBox 6x9 -> [0,0,432,648] pt +/- 2pt; (d) at least 1 font name in output matches open-license shipped font
- **Pass Condition**: tests/typesetting.test.ts artifact assertions
- **Evidence**: npm test Typesetting suite passing; stored artifact exists

### AC-6: Preview when unpaid; clean PDF when paid
- **Type**: `rule`
- **Given**: Job has 2 artifacts, 0 paid Payments
- **When 1**: GET /api/jobs/[id]/download (unpaid)
- **Then 1**: Streams preview_pdf; Content-Disposition filename contains "preview"; page count <= env(PREVIEW_PAGES, 15) OR PDF buffer contains PREVIEW watermark text
- **When 2**: Insert Payment(status="paid"); GET /api/jobs/[id]/download again
- **Then 2**: Streams interior_pdf; filename contains "print_ready"; full page count; no PREVIEW string in bytes
- **Pass Condition**: tests/payments.test.ts 2-scenario assertions
- **Evidence**: npm test Payments suite passing

### AC-7: Stripe Checkout session + webhook unlocks payment
- **Type**: `rule`
- **Given**: Stripe test key in env
- **When 1**: POST /api/checkout/sessions {jobId}
- **Then 1**: Returns {sessionId, url}; Payment row created with stripeSessionId, status="pending", amountCents=PRICE_CENTS(2900)
- **When 2**: POST /api/webhooks/stripe signed checkout.session.completed (or stripe trigger)
- **Then 2**: Payment.status="paid", stripePaymentIntentId stored, 200 OK
- **Pass Condition**: tests/stripe.test.ts SDK mock passes both endpoints
- **Evidence**: npm test Stripe suite passing; manual: stripe trigger CLI -> DB shows paid row

### AC-8: Resend delivers all 3 email flows (no stubs)
- **Type**: `rule`
- **Given**: RESEND_API_KEY set (or SDK mock)
- **When 1**: POST /api/auth/signin {email}
- **Then 1**: Resend SDK called with magic link 15min token; EmailLog has real resendMessageId NOT prefixed "resend_stub_"
- **When 2**: Worker sets status=ready, user email attached
- **Then 2**: Resend job-ready email dispatched with pre-signed download URL; EmailLog row exists
- **When 3**: POST /api/email {jobId, email}
- **Then 3**: Real Resend dispatch, paid/preview status in body
- **Pass Condition**: tests/email.test.ts SDK mock assertions + EmailLog content assertions
- **Evidence**: npm test Email suite passing

### AC-9: Production hardening enforced
- **Type**: `rule`
- **Given**: Server running
- **When 1**: Upload 51MB payload OR plain-text file mis-saved as .docx (invalid PK magic)
- **Then 1**: 413/422; no BookJob/ManuscriptAsset row created
- **When 2**: GET /api/health
- **Then 2**: JSON {ok, postgres, redis, s3, uptimeSec}; 200 if all alive else 503
- **When 3**: Same user upload > 10 times within 10 minutes
- **Then 3**: 429 Too Many Requests with Retry-After header
- **Pass Condition**: tests/hardening.test.ts size/magic/rate/health assertions
- **Evidence**: npm test Hardening suite passing

### AC-10: Deploy artifacts exist (prod compose + worker)
- **Type**: `rule`
- **Given**: Fresh clone, cp .env.example .env, set secrets
- **When 1**: docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
- **Then 1**: app + worker + postgres + redis all healthy (no minio prod)
- **When 2**: ls repo root for fly.worker.toml, Dockerfile.worker, deploy.sh
- **Then 2**: Files exist; deploy.sh single-command deploys web+worker; next.config.js output="standalone" confirmed
- **Pass Condition**: ls + docker compose config validate; README documents Vercel vs external worker
- **Evidence**: File tree listing + docker validate output

### AC-11: Full E2E browser journey with Stripe test checkout
- **Type**: `rule`
- **Given**: Dev server, Stripe CLI forwarding, Resend mock, demo account seeded
- **When**: Browser/Playwright executes: Land -> Sign-in demo -> Upload philosophy fixture -> Classic template -> 6x9 trim -> Create book -> Wait ready 120s max -> Download preview watermark confirmed -> Stripe test 4242424242424242 success -> /ready paid=true -> Download clean PDF -> Email-me stores non-stub EmailLog
- **Then**: Every step 200/success; clean PDF >= 50KB full pages no watermark
- **Pass Condition**: npx playwright test exits 0 OR browser-agent reports 100% success
- **Evidence**: E2E test report + exit 0

### AC-12: One-command start works, README is ship doc
- **Type**: `rule`
- **Given**: Fresh environment
- **When 1**: cp .env.example .env && docker compose up --build -d && sleep 30 && curl -f http://localhost:3000/ | head -1
- **Then 1**: HTML contains "Your manuscript in"; curl exit 0
- **When 2**: grep sections of README.md
- **Then 2**: Contains: (a) mermaid architecture diagram (b) env matrix table (c) fixture steps (d) deploy section Vercel+Fly/Railway (e) known limits box
- **Pass Condition**: curl success + grep all sections found
- **Evidence**: Terminal shell exit codes + grep counts

### AC-13: Bookstore UI quality (calm aesthetic, mobile integrity)
- **Type**: `rubric`
- **Dimension**: Visual design quality + mobile layout integrity
- **Scale**: 1-5
- **Anchors**: 1 = jarring palette, 360px overflow; 3 = functional but generic; 5 = warm paper palette (#F8F5EE/#1C1917/#A34825), serif typography feels book-like, all new pages (privacy, terms, analysis summary) have zero overflow on 360x640
- **Pass Threshold**: >= 4
- **Evidence**: 360px screenshots + reviewer score recorded in tasks.md completion evidence

### AC-14: Content integrity (author text never rewritten)
- **Type**: `rubric`
- **Dimension**: Faithfulness of analysis + rendering pipeline to author's original text
- **Scale**: 1-5
- **Anchors**: 1 = analyzer rewrites sentences or drops paragraphs; 3 = all paragraphs present but heading levels mixed; 5 = paragraph text byte-identical (whitespace normalized) in BookStructureJSON blocks vs source DOCX, zero text added/removed, typos only in warnings[] entries if flagged
- **Pass Threshold**: >= 4
- **Evidence**: tests/integrity.test.ts paragraph match diff count output; reviewer score

### AC-15: Error resilience (timeout + retries + dead-letter)
- **Type**: `rule`
- **Given**: Mock Typst compile hangs 20 minutes
- **When**: Dispatch job with mock hang flag
- **Then**: Within JOB_TIMEOUT_MS+30s buffer, job status transitions failed; after attempts=2 retries exhausted, errorMessage prefixed "[DeadLetter]"; no further work queued for jobId
- **Pass Condition**: tests/resilience.test.ts state transition timing assertions
- **Evidence**: npm test Resilience suite passing

## Open Questions
- [ ] None. All ambiguities resolved by publisher-grade defaults:
  - Template default: Classic
  - Trim default: 6x9
  - PRICE_CENTS: 2900
  - PREVIEW_PAGES: 15
  - FILE_RETENTION_DAYS: 30
  - JOB_TIMEOUT_MS: 900000
  - UPLOAD_MAX_BYTES: 52428800 (50MB)
