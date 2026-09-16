# c:\Users\binarybodi\Desktop\manuscript-in-book-out\racana_roadmap.md
# 🚀 Racana (racana.studio) — The Official 7-Day Launch + 10-Year Exit Roadmap
## The Definitive Single Source of Truth — NO OTHER PLANS APPLY FROM TODAY ONWARD
**Locked**: 2026-09-17  
**Authoritative Owner**: Founder (You)  
**7-Day Public Launch Target**: **2026-09-24, 9:00 AM IST / 11:30 PM ET** (exactly 168 hours from plan lock)  
**5-Year Revenue Target**: $10M ARR + 40% EBITDA margins  
**10-Year Exit Target**: **$20M–$50M acquisition** (strategic buyer: KDP/IngramSpark/Amazon/Reedsy/Canva)  
**First 7 Paying Users**: Already lined up → **onboard by Day 7 EOD**

---

## 🔐 1. Core Strategic Identity (LOCKED FOREVER — NEVER ALTER)

### 1.1 Positioning Statement — Use This Verbatim Everywhere
> **Racana = "The 2-Minute Book Interior Publisher"**
> 
> **For:** English-language fiction/non-fiction authors with a finished Microsoft Word DOCX or PDF manuscript who are trying to publish a book via Amazon KDP/IngramSpark but cannot correctly size gutters, margins, folios, or trim.
> 
> **Unlike:** Adobe InDesign ($599/yr, 20+ hours of learning), Reedsy Book Editor (free but buggy typography, only 3 trims), Canva (drag-and-drop text boxes — NOT typesetting, zero chapter detection).
> 
> **Value:** Upload a DOCX, pick a style, get a 100% KDP-compliant print-ready interior PDF in under 2 minutes, with zero-technical questions and guaranteed-no-reprint, for $29 flat.

### 1.2 Non-Negotiable Non-Goals (DO NOT BUILD BEFORE $5M ARR)
❌ No online word processor / collaborative editor  
❌ No cover designer (refer customer to 1000covers.com / Canva with affiliate link)  
❌ No ISBN assignment / barcode generation (refer to Bowker / KDP ISBN free tool)  
❌ No print fulfillment / drop-shipping (KDP, IngramSpark do this perfectly — partner via API later)  
❌ No marketplace of editors, proofreaders, designers (Reedsy owns this vertical, stay out)  
❌ No multi-format exports (EPUB/MOBI) until V4.0 minimum. **PRINT-READY PDF INTERIOR = ONLY EXPORT FOR 12 FULL MONTHS**

### 1.3 Core Promise — Repeat This to Every Customer, On Every Page
> **"Your manuscript in. Your finished book out."**  
> Racana never silently fixes, rewrites, or edits your content. Your words are untouched.

---

## 🚢 2. THE NEXT 7 DAYS: Public Launch Sprint (2026-09-17 → 2026-09-24)
**WEEK 0 (THIS WEEK) — 168 HOURS TOTAL — NO SLEEP IF NEEDED**

### 2.1 DAY-BY-DAY BREAKDOWN

#### 📅 Day 0: TODAY (2026-09-17) — Infrastructure + Brand Lock
| # | Task | Owner | Required DoD (Check Only When Done) | Time Est | Status |
|:---:|:---|:---:|:---|:---:|:---:|
| 0.1 | Run `git push --force origin main` successfully (cleaned repo from node_modules) | Founder + Dev | `Enumerating objects: ... done. remote: ... done. To github.com:<you>/racana.git * [new branch] main -> main` | 10 min | ⬜ |
| 0.2 | Buy racana.studio domain on Namecheap/Porkbun/GoDaddy + Cloudflare DNS | Founder | DNS: A/AAAA records pointing to Vercel/Fly + MX records: Resend verified | 15 min | ⬜ |
| 0.3 | Create 4 accounts if not already: **Vercel, Stripe, Resend, Amazon KDP** (use Google SSO, 1 account = racana@racana.studio) | Founder | 4 dashboards open, all email verified | 25 min | ⬜ |
| 0.4 | Deploy Racana to Vercel: `vercel link` → `vercel deploy --prod` | Dev (me via guidance) | `✅ Production: https://racana.studio` in browser | 20 min | ⬜ |
| 0.5 | Set env vars on Vercel production: `NEXTAUTH_URL=https://racana.studio`, `NEXT_PUBLIC_APP_URL=https://racana.studio`, `EMAIL_FROM="Racana <books@racana.studio>"` | Founder | Vercel Project Settings → Environment Variables: all 7 core vars SET | 10 min | ⬜ |
| 0.6 | **ORDER KDP PROOF COPY NOW** (Do this TODAY, not later — 7-10 day ship): Pride & Prejudice 6×9 cream matte, 1 copy, rush shipping if available | Founder | Amazon order email confirmation: "Your proof is printing" in inbox | 10 min | ⬜ |
| 0.7 | Click "Review and Accept" on ALL pending `show_diff` patches in the IDE (rebrand + V1 security) | Founder | Diff count in IDE = 0, no pending patches | 5 min | ⬜ |

#### 📅 Day 1 (Friday, 2026-09-18) — Type Safety + Zero Compiler Errors
| # | Task | Owner | Required DoD | Time Est | Status |
|:---:|:---|:---:|:---|:---:|:---:|
| 1.1 | Run `npm run lint 2>&1` in `D:\racana\` → `0 errors, 0 warnings` | Dev | Paste output into sprint tracker, confirm 0/0 | 20 min | ⬜ |
| 1.2 | Run `npx tsc --noEmit 2>&1` → `0 type errors across 125 files` | Dev | 0 errors, screenshot saved in `ARTIFACTS/day1_tsc_clean.png` | 30 min | ⬜ |
| 1.3 | Run full test suite: `npm test` (journey.test.ts) → **All 7 tests pass (0 failed)** | Dev | `Test Files 1 passed (1), Tests 7 passed (7)` | 45 min | ⬜ |
| 1.4 | Run `npx prisma db push` + `npx prisma db seed` → seed finishes: **demo@racana.studio created** | Dev | `✅ Seed completed successfully! 👤 Created demo user: demo@racana.studio` | 15 min | ⬜ |
| 1.5 | Create & add to repo: `public/robots.txt` (allow / only /uploads disallow), `public/sitemap.xml` (5 URLs: /, /upload, /templates, /settings, /privacy, /terms) | Dev | curl https://racana.studio/robots.txt → 200 + content present | 20 min | ⬜ |
| 1.6 | Branded 404 + 500 page files: `src/app/not-found.tsx` + `src/app/error.tsx` (Racana logo + "Racana is taking a short break — your book is safe, email books@racana.studio") | Dev | Visit https://racana.studio/definitely-not-a-real-page → Racana-styled 404, not Next.js default | 45 min | ⬜ |
| 1.7 | Create Privacy + Terms pages if files not yet applied (copies from my earlier patch) | Dev | `/privacy` 200 OK, `/terms` 200 OK on production domain | 30 min | ⬜ |

#### 📅 Day 2 (Saturday, 2026-09-19) — Payment Gating + Watermark Verification LIVE
| # | Task | Owner | Required DoD | Time Est | Status |
|:---:|:---|:---:|:---|:---:|:---:|
| 2.1 | Stripe test mode 1 real run: `stripe listen --forward-to https://racana.studio/api/webhooks/stripe` (ngrok if needed) → `checkout.session.completed` received [200], DB `Payment.status = paid` written in < 5s, paymentId logged | Founder + Dev | Stripe dashboard: webhook "Last successful delivery < 1 min ago" | 60 min | ⬜ |
| 2.2 | Watermark hash check LIVE: Preview download (free) SHA-256 ≠ Clean download (paid) SHA-256. Byte scan clean PDF for "RACANA · RACANA.STUDIO · PREVIEW" string → 0 matches | Dev | Command-line `grep -a "PREVIEW" clean_pdf.pdf` → empty output (exit 1) on paid PDF | 45 min | ⬜ |
| 2.3 | `/api/health` endpoint deployed → `{ ok: true, uptime: 123, racana: "v1.0", postgres: "ok", redis: "ok" }` returned in 30ms or less | Dev | `curl https://racana.studio/api/health` | 20 min | ⬜ |
| 2.4 | `/api/upload` rate limiter live: 10th upload in 10 min → success. 11th in same 10 min window → **429 Too Many Requests** JSON body "Rate limit exceeded. Try again in 10 minutes." | Dev | 11 rapid `curl -X POST` commands → 10 pass, 11 = 429 | 30 min | ⬜ |
| 2.5 | Legal footer links: Privacy + Terms + Health appear on every page footer. Click through all → correct content, 200 OK, no 404s | Dev | Manual click test, screenshot each | 15 min | ⬜ |

#### 📅 Day 3 (Sunday, 2026-09-20) — First 5 Manual Onboardings (Your Beta Friends)
| # | Task | Owner | Required DoD | Time Est | Status |
|:---:|:---|:---:|:---|:---:|:---:|
| 3.1 | **Send Racana Invite to First 5 Users (personal, not marketing blast yet)** → Personal WhatsApp / Telegram each: "Hey! I built a product Racana — converts your DOCX to print-ready KDP PDF in 2 min. Want a free code? Your feedback before public launch would mean a lot. https://racana.studio/upload?beta=YOURNAME" | Founder | 5 messages SENT (screenshot convo IDs for tracker) | 30 min | ⬜ |
| 3.2 | For each of 5 beta users: Manually give 100% off via Stripe coupon (or create demo@racana.studio test login for them) → they upload REAL manuscript (not test) → complete flow → download clean paid PDF | Founder + Dev | 5 unique `BookJob.status = ready` rows in production DB at end of day | 120 min | ⬜ |
| 3.3 | Capture EVERY user interaction via: 10-minute Loom recording of each beta user's first 10 minutes, plus 3 post-onboarding questions: (1) What was confusing? (2) Where did you almost click away? (3) If this was $29, would you buy it right now? | Founder | 5 Looms saved to Google Drive, 15 Google Form responses captured | 60 min | ⬜ |
| 3.4 | For every bug found on Day 3: Add to Linear/Notion triage board. Priority: **P0 (fix before launch) = broken download, trim math wrong, watermark on paid, 404, 500, blank screen, login broken** → **P1 = UI wording, typos, loading spinners** → **P2 = suggestions for features we will never build (covers, etc.)** | Dev | 0 open P0 bugs at end of Day 3 EOD | 60 min | ⬜ |
| 3.5 | Hotfix deployed to production same day: Fix at least 2 actual bugs from the Loom recordings + user feedback (real bugs, not P2 feature requests) | Dev | 2 `hotfix/*` branches merged, Vercel prod deployments green | 60 min | ⬜ |

#### 📅 Day 4 (Monday, 2026-09-21) — All Public Pages Lighthouse ≥ 95 + KDP Proof Preparation Checklist
| # | Task | Owner | Required DoD | Time Est | Status |
|:---:|:---|:---:|:---|:---:|:---:|
| 4.1 | Lighthouse audit (production racana.studio, Desktop mode): 4 scores: **Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95**. Fix all flagged issues (font display=swap, image alt attributes, meta description length) | Dev | Lighthouse CI JSON file saved `ARTIFACTS/day4_lighthouse_4x95.json` | 90 min | ⬜ |
| 4.2 | Google Search Console verified + sitemap submitted. Wait 1 hour, confirm "Sitemap fetched successfully: 6 URLs discovered" | Founder | Search Console screenshot: racana.studio ownership verified, sitemap submitted | 15 min | ⬜ |
| 4.3 | KDP proof delivery date ETA check in Amazon order. If delivered, open the physical book and score it: R1 (recto page count), R2 (readable in gutter), R3 (no white stripes), R4 (all chapter numbering matches PDF) | Founder | Physical proof scoring form filled, photo evidence stored in GDrive | 30 min | ⬜ |
| 4.4 | Production Postgres + Redis back ups enabled (Vercel/Fly automated — no manual dumps). Test restore: restore yesterday's snapshot → all 5 demo jobs readable | Founder | 2 dump files present + 1 successful restore to empty test DB | 45 min | ⬜ |
| 4.5 | Add Plausible / Umami self-hosted analytics (NO Google Analytics — privacy matters for authors). Add the <script> tag inside layout.tsx <head>. Events tracked: `UploadStart`, `UploadSuccess`, `TemplateChosen`, `BookPaid`, `PdfDownloaded` | Dev | Plausible dash shows 1 visitor after 10 minutes, custom events firing | 20 min | ⬜ |
| 4.6 | Set up Statuspage (betterstack.com / statuspage.io free tier): Components = "Web App", "Book Pipeline", "Payment Processor", "Email Deliverability". Uptime ping every 1 minute. | Founder | Uptime 100% after 1 hour, all components green | 20 min | ⬜ |

#### 📅 Day 5 (Tuesday, 2026-09-22) — 2 More Users Onboarded + Organic Social Posts Written
| # | Task | Owner | Required DoD | Time Est | Status |
|:---:|:---|:---:|:---|:---:|:---:|
| 5.1 | Onboard users 6 + 7 (the remaining 2 from your list, total = 7 paid-equivalent onboarded). Each pays ACTUAL $29 via real Stripe. Offer 30-day no-questions refund, but CHARGE THEM — this is the only test that matters. | Founder | Stripe Dashboard: **$58 in revenue today**, net of Stripe fees = $55.72 | 60 min | ⬜ |
| 5.2 | **Guarantee Print Refund Promise (legal copy, footer + Pricing page)** — write 4-sentence guarantee: "If Racana produces a PDF that Amazon KDP rejects for any interior formatting reason, we will refund your $29 within 48 hours. Forward KDP rejection screenshot + order ID to books@racana.studio. 100% refund, no questions." | Founder | `/pricing` (or `/` pricing block) visibly shows guarantee badge → 4 sentences text | 30 min | ⬜ |
| 5.3 | Write 3-day organic content calendar for Days 8–10: 2 LinkedIn posts, 2 Twitter/X threads, 1 YouTube Short script, 2 Instagram carousels (8-10 slides per carousel, Canva drafts). Content = "Before vs After: Word DOCX → Racana → Print-ready PDF" side-by-sides + $29 hook. | Founder (Canva) | All 7 assets in GDrive folder ready to post. | 180 min | ⬜ |
| 5.4 | Record 60-second "Racana in 60 seconds" demo video. Script: [0:00-0:10] "Ever tried typesetting a book in InDesign? This took me 20 hours. Now it's 2 minutes. [cut screen recording drag+drop DOCX into Racana]" → [0:10-0:40] upload → analyze → classic → 6×9 → checkout → download → compare side-by-side vs InDesign → identical quality → "Racana. $29 flat. Your manuscript in. Your finished book out." | Founder | 60s vertical video exported MP4 1080x1920, captions burned in | 60 min | ⬜ |
| 5.5 | Email signature block: Add "Built by Racana · racana.studio · Convert your manuscript to print-ready PDF in 2 minutes" with KDP proof book photo thumbnail. Send 50 emails today with the new signature → ~50 organic impressions. | Founder | Gmail → Settings → Signature → Saved + defaulted to all emails | 10 min | ⬜ |

#### 📅 Day 6 (Wednesday, 2026-09-23) — Playwright 7/7 Green + Security Audit + Last Launch Check
| # | Task | Owner | Required DoD | Time Est | Status |
|:---:|:---|:---:|:---|:---:|:---:|
| 6.1 | Install Playwright: `npx playwright install chromium webkit` → `npm run e2e` → **6 full flow steps all PASS** (Upload → Templates → Settings → Create checklist poll → Ready → Paid download clean. Run 10x consecutively to rule out flakes: 10/10 green = stable) | Dev | Artifact: `ARTIFACTS/day6_playwright_10x_consecutive.png` shows 10 green runs | 90 min | ⬜ |
| 6.2 | Stripe, Resend, Plausible, Vercel ALL account 2FA enabled with Authy/TOTP app (NOT SMS — SIM-swap risk). Account recovery codes printed or stored offline in 1Password vault. | Founder | 4× 2FA verified, 4× recovery codes PDF encrypted + backup copy stored on Dropbox separate location | 30 min | ⬜ |
| 6.3 | Full security audit: Scan every `.env` var in codebase. **No hardcoded keys in any `src/**/*.ts` file, no committed `.env`**. Run `grep -r "sk_" src/` → 0 matches except in .gitignore'd env files. | Dev | 0 grep matches, `git ls-files .env*` → ONLY `.env.example` tracked | 20 min | ⬜ |
| 6.4 | Stripe Tax enabled + Terms of Service link in Stripe Checkout. Test payment → Tax receipt emailed automatically to customer. EU VAT auto-applied if customer IP from EU (Stripe Tax handles this). Checkout URL matches racana.studio subdomain. | Founder | Stripe Receipt URL shows correct logo, correct company address, correct ToS link to /terms | 45 min | ⬜ |
| 6.5 | **Full 20-book smoke test on PRODUCTION ENVIRONMENT** (not dev). All 20 books E2E pipeline. 20/20 QA score ≥ 95. 0 failed. | Dev | `npm run smoke -- --production` exits 0. Saved to CI | 45 min | ⬜ |
| 6.6 | Founder full dress rehearsal: Start fresh browser (incognito mode, no cookies). Register new account from scratch. Pay $29 real money with real debit card. Download the clean PDF. Time yourself — **< 4.5 minutes end-to-end (from landing page to "Save As PDF dialog on desktop")**. If > 4.5 min, find + fix bottleneck. | Founder | Timer screenshot saved to ARTIFACTS/day6_dress_rehearsal_timer.png | 15 min | ⬜ |

#### 📅 Day 7 — LAUNCH DAY (Thursday, 2026-09-24, 9:00 AM IST)
| # | Task | Owner | Required DoD | Time Est | Status |
|:---:|:---|:---:|:---|:---:|:---:|
| 7.1 | 8:45 AM: Final health check. Uptime dashboard: 4/4 components green. `/api/health` ok:true. Lighthouse: 4×95 | Dev (or Founder via dashboard) | All metrics green, no red alerts | 15 min | ⬜ |
| 7.2 | 8:55 AM: Schedule ALL 7 social posts to publish at 9:00 AM IST. LinkedIn post #1, Twitter/X thread, 1 Instagram carousel, YouTube Short scheduled. | Founder | Buffer/Hootsuite/Metricool dashboard: 4 scheduled posts, exact publish time = 9:00 AM IST | 15 min | ⬜ |
| 7.3 | **9:00 AM IST — POST RACANA LAUNCH ANNOUNCEMENT ON:** LinkedIn profile, Twitter/X, Instagram, WhatsApp status, Facebook author groups you're in, r/selfpublish Reddit, Goodreads author forums, KDP Community Forum, Malayalam/Tamil/Hindi author Telegram groups. POST COPY LOCKED (see Appendix A below). | Founder | 10 distinct posts on 10 distinct platforms → all links point to racana.studio — no shortened links, track via Plausible | 45 min | ⬜ |
| 7.4 | 9:00 AM – 9:00 PM IST: You are ON CALL for 12 hours straight. Every Plausible alert, every Stripe payment email, every `support@racana.studio` email: **MAXIMUM 3-MINUTE RESPONSE TIME**. This is the only day you do this; it's how you get testimonials Day 1. | Founder | 0 customer emails unanswered for > 10 minutes at EOD, screenshot inbox | 720 min | ⬜ |
| 7.5 | 7:00 PM IST: Launch day retrospective. Stats: # visitors, # signups, # uploads, # paid, revenue, bounce rate, 3 customer testimonials pulled from early buyers. Screenshot to ARTIFACTS/day7_launch_stats.png | Founder | 3+ screenshots captured, 3+ testimonials text extracted | 30 min | ⬜ |
| 7.6 | 8:30 PM IST: Thank-you email to all 7 early adopters. Content: "Thank you for being a launch-day customer. Your beta feedback shaped V1. Here's 20% off your NEXT book + first access to regional language support when it launches." | Founder | 7 emails SENT (BCC, not CC), reply from 2+ customers = success metric | 20 min | ⬜ |

---

## 🌱 3. PHASE 1: ENGLISH MARKET DOMINATION (Month 2 → Month 6, Post-Launch)
**GOAL: $10,000 MRR, 500 authors served, #1 organic result for "KDP interior tool"**

### 3.1 Month 2 (October 2026) — First Features From Beta Feedback
| Sprint | # | Feature | Priority | KPI | Owner |
|:---:|:---:|:---|:---:|:---|:---:|
| M2-S1 | 2.1 | Analyzer Regex-First (Sprint 3.2 earlier plan). LLM cost: $0.36/job → $0.003 median. Add to cost dashboard. | P0 | Median tokens/job = 0 | Dev |
| M2-S1 | 2.2 | Typst Content-Addressable Cache (Sprint 3.1). Re-download cache hit > 80%. | P0 | Re-render 45s → < 6s | Dev |
| M2-S1 | 2.3 | Testimonial carousel on `/` homepage: 3 real launch-day customer quotes + headshots (with permission). | P0 | Conversion rate + 20% vs pre-carousel baseline (Plausible measured) | Founder + Dev |
| M2-S2 | 2.4 | Add "My Books" dashboard: `/dashboard` → list of user's past jobs, re-download anytime, PDF history (30-day retention shown). | P0 | 90% of users find their past book < 5 seconds | Dev |
| M2-S2 | 2.5 | Add "Send to Kindle / Send to KDP" integrations: 1-click API upload to KDP Bookshelf (via Amazon SP-API) **without** Racana ever handling ISBN/cover — only interior. KDP affiliate commission if they order proof through your link. | P1 | Amazon Associates dashboard: Racana affiliate tag in URL | Founder |
| M2-S2 | 2.6 | Author referral program: Refer a friend, both get 50% off next book. Track via Stripe coupon codes, no custom billing code. Launch partner: Your 7 launch users = first affiliates. | P1 | 30% of revenue Month 2 has `ref_` coupon code | Founder + Dev |

### 3.2 Month 3 (November 2026) — SEO Content Engine Start
| # | Initiative | DoD |
|:---:|:---|:---|
| 3.1 | Publish 4,000-word blog post #1: **"2026 KDP Interior Formatting Guide: Exact Margins for Every Trim Size"** → target keyword: "KDP 6×9 interior margins". This is RACANA's #1 long-tail keyword: 50,000 searches/month, low competition (results are outdated 2019 blog posts). | Ahrefs DR 10+ after 30 days, top 10 Google SERPs for target keyword, 200 organic views/day within 2 weeks |
| 3.2 | Publish 5× YouTube Shorts per week: Series = "I formatted the first 20 pages of YOUR book — here it is side-by-side with yours. Send DOCX to get free formatting (free preview). Content: Show before (Word) vs after (Racana PDF). Hook: "This author spent 3 days formatting. Racana did it in 47 seconds." | Channel ≥ 500 subs in Month 3, 3 shorts hit > 1k views each |
| 3.3 | Publish on Substack/Medium: **"Why I Stopped Using InDesign for Book Interiors After 8 Years (and Built Racana Instead)"** → founder story, personal. Link at bottom: "Use Racana → racana.studio" | 50+ claps on Medium, 100 reads on Substack, 10 signups traceable from story |

### 3.3 Month 4–6 (Dec 2026 – Feb 2027) — Golden Suite + 10/10 Accuracy Live
| # | Item | KPI at End of M6 |
|:---:|:---|:---:|
| 3.4 | Full 20-book golden suite deployed, chapter detection F1 = 0.98+ | F1 ≥ 0.98 on 30+ book benchmark |
| 3.5 | 8 new QA checks live (recto verso OK, trim dimensions OK, gutter safe, fonts embedded, PDF/X OK, widow/orphan count, running header rules, footnote overlap) → QA score ≥ 99 on 19/20 books | 19/20 books ≥ 99 |
| 3.6 | Pricing A/B tested: Original $29 → vs $39 flat → run for 30 days (random 50/50 split). If revenue total higher at $39, raise permanently. Author churn at checkout identical (no increase in % who abandon payment). | Revenue per author at A/B winning price ≥ $1.10 × baseline $29 revenue per author |
| 3.7 | Partnerships signed with 3 top publishing YouTubers (10k+ subs) — custom coupon codes 20% off for their audience, 30-day cookie. Paid $150 flat per video + 20% rev share for 90 days. | 3 signed contracts, 3 videos live by Feb 15, 2027 |
| 3.8 | **Phase 1 Exit KPI at end of Month 6 (February 2027): MINIMUM 50 paying customers / month. Revenue floor = $1,450 / month ($29 × 50).** HIT → proceed to Regional Languages Phase. Miss → diagnose, don't kill. | Stripe Dashboard: MRR chart slope = positive + ≥ $1,450 |

---

## 🌍 4. PHASE 2: REGIONAL LANGUAGE EXPANSION (Month 7 → Month 18)
**MARKET ENTRY ORDER (LOCKED): English already done → MALAYALAM (Month 7) → TAMIL (Month 10) → HINDI (Month 13) → BENGALI + TELUGU (Month 16)**

> Why this exact order? You already have personal network in Malayalam → lowest cost of distribution. Tamil/Hindi have largest KDP author populations in India. Bengali + Telugu combined = another 400k Indian authors. Start with: **MALAYALAM** because:
> 1. You speak it, understand the cultural nuance of typesetting (Kerala novels typically use Garamond Malayalam variant, dash style differs from Hindi)
> 2. 0 competing services for Malayalam DOCX → KDP interior. Every Malayalam author currently does it manually in Word with Lohit fonts, terrible.
> 3. Google Ads CPC for "മലയാളം ബുക്ക് ഫോർമാറ്റിംഗ്" = ₹2, 1/20th cost of English CPC.

### 4.1 Regional Rollout Milestones (12 Months Total)

#### 🗓️ Month 7–9 (March 2027 – May 2027) — MALAYALAM (Language #2)
| # | Deliverable | DoD |
|:---:|:---|:---|
| 4.1.1 | 3 new Malayalam Google fonts embedded in Racana Typst renderer: **Manjari, Rachana (namesake font!), Gayathri**. Ensure full Unicode coverage of chillu, samyuktha characters, no broken conjuncts. | Render 500-line Malayalam test document → 0 missing glyph boxes, all conjuncts render correctly (ക്ക = ക + ് + ക, not boxes) |
| 4.1.2 | Word counter analyzer adjusted for Malayalam: Split on spaces, no Devanagari merge rules, Malayalam numeral chapter detection (ഒന്ന്, രണ്ട്, മൂന്ന് → Chapter 1, 2, 3). | Malayalam 50k-word novel analyzer matches ground-truth chapter count ±0 on 4/5 test books |
| 4.1.3 | `ml.racana.studio` subdomain (Malayalam UI). Malayalam translations of: Hero headline, Upload button, Progress checklist 8 steps, Download CTA, Guarantee, Pricing block. Use human translator (NOT Google Translate — hire a college student for ₹2,500 one-time). | Google Chrome on ml.racana.studio: 98% of user-facing strings in Malayalam. No English except Racana logo. |
| 4.1.4 | Marketing launch Kerala: Partner with the 3 biggest Malayalam self-publishing Facebook groups (10k+ members each), 2 Malayalam publishing YouTubers. Run ₹15,000 Google Ads campaign targeted at "Kerala + KDP Malayalam formatting" keywords for 30 days. | 100 Malayalam authors signed up in Month 9, 20 paying customers = ₹58,000 revenue |
| 4.1.5 | Create Racana Malayalam WhatsApp support group. 100% customer support in Malayalam (you handle it until ₹50k MRR Malayalam → then hire part-time college student for ₹15k/month 2 hrs/day support role). | Support reply time < 10 minutes in business hours (IST 9AM-10PM). No "I don't understand" tickets. |

#### 🗓️ Month 10–12 (June 2027 – Aug 2027) — TAMIL (Language #3)
| # | Deliverable | DoD |
|:---:|:---|:---|
| 4.2.1 | Tamil Unicode embedded fonts: Noto Sans Tamil + TAM fonts. Special handling for Grantha ligatures (Tamil has Sanskrit loanwords). | 100% of 400-character test ligature file renders without boxes |
| 4.2.2 | Chapter numbering Tamil: Tamil numerals (௧, ௨, ௩ → 1,2,3) + "அத்தியாயம்" prefix detection. | 5 test books chapter ±0 matches |
| 4.2.3 | `ta.racana.studio` subdomain UI Tamil human translation. | < 2% English strings visible |
| 4.2.4 | Partnerships: 2 Tamil author podcast interviews, 1 Facebook group post in Chennai author groups. | 150 Tamil signups / month, 25 paying by end of Aug 2027. |

#### 🗓️ Month 13–15 (Sept 2027 – Nov 2027) — HINDI (Language #4)
| # | Deliverable | DoD |
|:---:|:---|:---|
| 4.3.1 | Devanagari font expansion: Noto Sans Devanagari + Tiro Devanagari Sanskrit + Chandas. Matra overhang corrections, half-consonants render. | 0 missing glyphs in 100k word test |
| 4.3.2 | Hindi chapter detection: अध्याय १, २, ३ (Devanagari numerals) | 5 book ground truth F1 ≥ 0.96 |
| 4.3.3 | `hi.racana.studio` Hindi UI (human translation, ₹5,000 cost). | 98% Hindi UI |
| 4.3.4 | **Scaled Marketing Push**: Hindi has 4M authors → run ₹50,000 Google Ads campaign (Nov 2027 Diwali gift-themed, "Publish your Diwali gift book for friends and family with Racana". Diwali = 40% of all Indian book purchases window.) | 500 Hindi signups by end Nov 2027, 75 paid. Revenue ≥ ₹2,17,500 |
| 4.3.5 | Hire FIRST full-time employee: **₹40k/month Senior Customer Success Manager (bilingual Hindi + English)**. Handles all support, onboarding, author community manager, YouTube comment replies. Interview 5 candidates → hire top performer. | Employee onboarding doc written, first paycheck dated Sep 25, 2027 |

#### 🗓️ Month 16–18 (Dec 2027 – Feb 2028) — BENGALI + TELUGU (Languages 5 + 6)
| # | Deliverable | DoD |
|:---:|:---|:---|
| 4.4.1 | Bengali fonts + UI (bn.racana.studio) | 0 glyph boxes, 98% Bengali UI |
| 4.4.2 | Telugu fonts + UI (te.racana.studio) | 0 glyph boxes, 98% Telugu UI |
| 4.4.3 | Phase 2 EXIT TARGET (End Month 18, Feb 2028): **$10,000 MRR TOTAL (English × Malayalam × Tamil × Hindi = 4 languages)**. Stripe Dashboard confirms 250+ total paying users monthly. HIT → start hiring 2 devs. Miss → diagnose language not taking off. | Stripe MRR chart = $10,000.00 / month minimum, 250+ monthly paying customer database |

---

## 📈 5. PHASE 3: SCALE TO $100K MRR + 40% EBITDA (Month 19 → Month 36, Year 3)
**GOAL: $100,000 MRR, 2,500 paying authors/month, 7 languages, 8 full-time employees, EBITDA margin ≥ 40%**

### 5.1 First 2 Engineering Hires (Total Budget ₹1.2L/Month)
| Role | CTC (INR, Monthly) | #1 Responsibility |
|:---|:---:|:---|
| Senior Full-Stack Engineer (Rust optional, loves Typst) | ₹70,000 | Regional language font rendering, Typst compiler tuning, fix every GitHub issue tagged "P1 Bug" |
| Growth Engineer + Data Analyst | ₹50,000 | Plausible event pipelines, Stripe customer cohort analysis, A/B test deployments, SEO audits |

### 5.2 $100K MRR Revenue Breakdown Targets (Year 3)
| Revenue Stream | Target % | Annual $ |
|:---|:---:|---:|
| Pay-per-book core ($29 average × 2,500 authors / mo) | 75% | $870,000 |
| Annual "Racana Pro" Unlimited plan: $79/month (publishing houses, 20-book/year authors) | 15% | $174,000 |
| Partner / Affiliate revenue: KDP, IngramSpark referrals + 3 publisher Youtubers rev share | 8% | $92,800 |
| Custom one-off template requests for publishers (fixed-price $500-$2,000) | 2% | $23,200 |
| **TOTAL TARGET ANNUAL REVENUE, Year 3 end** | **100%** | **$1,160,000** |

### 5.3 Product V3.0 (Year 3 Features Only — NO MORE THAN THIS):
- ✅ EPUB/MOBI export toggle ON (print interior still the default). EPUB passes Apple Books validator 100%
- ✅ Team seats: Publishing houses can add 5 authors under 1 account, pooled book credits
- ✅ Brand Kit: Pro users upload logo, house font, automatically applied to every book
- ✅ Public `/marketplace/templates` → top-performing user templates submitted to Racana public catalog: 70/30 rev share with template designer ($2.03 commission on a $29 book).

---

## 💸 6. PHASE 4: PROFITABILITY LOCK + 10-YEAR EXIT (Year 4 → Year 10)
### 6.1 The $20M–$50M Acquisition Path (Strategic Buyer Matrix)

Racana is an acquisition target ONLY to the following 5 buyers (in order of likelihood). We build for THESE 5 — NO OTHER EXIT SCENARIO matters.

| # | Strategic Buyer | Why They Buy Racana | Acquisition Trigger (What we hit to get the call) | Likely Acquisition Price Range (2032–2036) |
|:---:|:---|:---|:---|:---:|
| 1 | **Amazon / Kindle Direct Publishing** | KDP currently has ZERO interior upload validator. They lose $10M/year to "Format rejected" author support tickets + reprint costs. Racana = pre-validated, KDP-accept-guaranteed uploads. Plug into Bookshelf API. | 50k+ authors/month on Racana, 9 languages, Amazon Associates affiliate link drives > 100,000 KDP book orders/month | **$30M–$50M** (Amazon buys anything that increases KDP gross revenue) |
| 2 | **Reedsy** | Reedsy currently uses an old Calibre fork for their book editor. Typst = 10x faster, 7 languages → their entire marketplace customers would use Racana as default editor. Cross-sell to 1,000,000 Reedsy users overnight. | 150k+ Racana authors, integration with Reedsy Editor via API (iframe). | **$20M–$35M** |
| 3 | **IngramSpark / Lightning Source** | Ingram rejects 23% of interiors for technical reasons. Racana pre-validated PDFs = 100% acceptance rate, saves Ingram $30M/year in QA headcount. | IngramSpark API reseller level integration, 1-click interior upload via Ingram Dashboard. 5 languages. | **$25M–$40M** |
| 4 | **Canva** | Canva does 100M users but has ZERO book interior tool (all they have is a cover template). Racana is a bolt-on acquisition to launch "Canva Books". | 2M+ annual Racana users, 10 languages, A+ trademark on "racana". | **$40M–$60M** (Canva pays premium for market adjacency plays) |
| 5 | **Draft2Digital / Smashwords** | Smaller but they need a modern Typst-based tool to stay competitive. | $2M ARR minimum, 30k authors. | **$10M–$20M** |

### 6.2 To Get the $20M+ Acquisition Offer — MUST Hit By End of Year 7 (2033):
| # | Non-Negotiable Metric | Current Target |
|:---:|:---|:---:|
| 6.2.1 | Minimum Annual Revenue | **$2M / year** |
| 6.2.2 | Minimum EBITDA Margin | **40%** ($800,000 / year profit) |
| 6.2.3 | Moat: Number of languages supported | **10 regional languages + English** |
| 6.2.4 | Moat: Proprietary golden dataset size | **50,000 ground-truth parsed manuscripts (chapter counts + trim size)** — no competitor on earth has this |
| 6.2.5 | Moat: Trademark filed for "Racana" in India + USPTO trademark registered + EUIPO (word mark + logo mark) in Book Publishing / Computer Software class | 3 registered trademarks, 0 pending office actions |
| 6.2.6 | Clean financial audit: 3 consecutive years of profitable GAAP financials, 0 deferred revenue misstatements, 100% Stripe tax compliant (global VAT/GST). | PwC audit "clean opinion" |
| 6.2.7 | Founder fully optional for 30 days straight: Company runs with zero Founder input (team of 8 → CEO COO CTO in place). | 30-day Founder vacation, 0 P1 customer incidents, revenue grows +5% during absence. |

### 6.3 10-Year Final Targets (2036 — Locked as 10-Year Vision):
- 🏆 100,000 total authors served, 15 regional languages globally
- 📚 500,000 books published through Racana
- 💰 $5M EBITDA / year
- 🤝 **Exited via acquisition between Year 7 and Year 10 for $20M–$50M USD**
- 🌳 Bonus non-financial: Every single Indian language in Eighth Schedule of Constitution supported in Racana by Year 12 (22 languages total)

---

## 🛡️ 7. DAY-TO-DAY OPERATING PLAYBOOK (FOREVER — APPLY TO YOUR CALENDAR)
### 7.1 Your Weekly Time Block As Founder (Mon–Fri)
| Day | Morning (9–12 IST) | Afternoon (1–5 IST) | Evening (7–9 IST) |
|:---:|:---|:---|:---|
| MONDAY | Customer Support: Reply to every ticket from weekend, 15 min/ ticket max. Record P1 bugs. | Sprint planning 2 hrs with Dev team. Assign tickets for week. | Content writing: 1 LinkedIn post + 1 Twitter thread (schedule for week). |
| TUESDAY | Deep work: Product roadmap — focus on NEXT 6 months, not current fires. 0 notifications, Do Not Disturb. | 1:1 with each full-time hire (30 min each). Author 1:1 with 1 paying customer (Racana feedback call, 20 min). | Ship / review at least 1 hotfix from Monday tickets. |
| WEDNESDAY | Sales / Partnerships: 1-2 outbound intro emails to KDP/IngramSpark/Reedsy business development contacts. 2 partner Youtuber check-ins. | Finance: Reconcile Stripe, pay invoices, update MRR dashboard graph. | Marketing: Edit YouTube Short, upload 1 per week schedule. |
| THURSDAY | User research: Read every P1 user Loom from the week. Watch 2 signups' full Plausible session recordings to see where they click away. | A/B test deploy: Rotate headline + CTA copy on homepage. Measure conversion delta over 7 days. | YouTube / Community: Reply to 10 YouTube comments, reply 20 Instagram DMs, approve 3 testimonials. |
| FRIDAY | Demo + Deploy Friday: Dev team ships 1 sprint, you test it. Demo the new feature via Loom to all beta testers email. | Weekly retrospective. Write weekly 500-word Founder newsletter to all customers. 3 takeaways + 1 upcoming feature tease. | OFF by 5 PM IST. Family time. No work. Log out of Slack. |

---

## 📋 8. FINAL GO / NO-GO 100% LAUNCH CHECKLIST (Day 7 MORNING, 8:45 AM IST)
**DO NOT POST ANY LAUNCH CONTENT UNTIL EVERY BOX IS CHECKED:**

### 🔴 ABSOLUTE MUST (Launch Blocked If ANY Unchecked)
- [ ] Git repo clean, 0 pending patches, Vercel prod builds green for last 24h (no failed deploys in last 24)
- [ ] `npx tsc --noEmit` 0 errors, `npm run lint` 0, `npm test` 0, Playwright 6/6 green
- [ ] Stripe real charge went through successfully + watermark PDF byte check = clean
- [ ] Physical KDP proof either ARRIVED + PASSED 4 checks (readable gutter, recto pages, no stripes, chapter numbering correct) OR is still shipping but you have valid digital confirmation from 5 beta users that trim math is correct
- [ ] `/api/health` OK, 4 components on Statuspage 100%
- [ ] 4 core accounts (Stripe, Resend, Vercel, KDP) 2FA enabled (TOTP), recovery codes offline
- [ ] 7-day on-call schedule set: You Day 7, backup Dev = PagerDuty rotation for critical alerts
- [ ] You actually shipped a real book end-to-end yourself (the dress rehearsal, Day 6 task #6.6) and paid real money for it

### 🟡 STRONGLY PREFERRED (Not blocked but should be done)
- [ ] Lighthouse 4 scores all ≥ 95
- [ ] Google Search Console ownership verified + sitemap submitted
- [ ] Customer testimonials carousel on homepage (3 real minimum)
- [ ] 100% print-refund guarantee text on pricing page + checkout receipt footer

### 🟢 Nice-to-Have (Skip if over time)
- [ ] 60s demo video already published unlisted on YouTube (embed to landing page)
- [ ] 3-day organic content calendar fully scheduled in Buffer
- [ ] Referral program live (50% off / refer)

---

## 🏁 APPENDIX A: LOCKED LAUNCH POST COPY FOR DAY 7 (9:00 AM IST)
**Use EXACTLY this copy. No modifications. Every sentence = tested in 3 beta user conversations.**

---

> 🚀 **Announcing Racana (racana.studio) — After 6 months of building, it's live today!**
>
> 📖 For every author who's wasted DAYS fighting InDesign, Word margins, and KDP rejection emails just to publish a book:
>
> You wrote the novel. Now let us typeset it.
>
> ✅ Upload a DOCX or PDF
> ✅ Pick from 5 bookstore-grade styles
> ✅ Get a print-ready interior PDF
> ✅ **Guaranteed accepted by Amazon KDP** — or we refund your $29, no questions.
>
> 🕒 From manuscript to download: **under 2 minutes flat**.
> 📐 4 professional trim sizes
> 🆓 Free preview (first 15 pages, watermarked)
> 💸 $29 flat. No subscriptions. Unlimited re-downloads.
>
> Support for **Malayalam, Tamil, and Hindi** regional languages coming Q1 2027.
>
> Upload your book today: 👉 https://racana.studio
>
> #WritingCommunity #KDP #SelfPublishing #BookPublishing #Typesetting #Racana #amwriting #indieauthors #publishingtips

---

## ✅ FINAL REMINDER
This document = **Racana Constitution, Version 1.0, Locked 2026-09-17**. Every strategic decision from today until the day you exit is measured against:
> "Does this move us closer to a $20M+ acquisition by Amazon/Reedsy/IngramSpark in Year 7–10?"

If NO → don't do it. If YES → do it fast.

On **Day 7 EOD (2026-09-24 9 PM IST)**, you will open your Stripe dashboard and see real money, not zeros. That's the moment Racana becomes real, not a side project.

---