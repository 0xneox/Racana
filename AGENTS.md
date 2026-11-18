# Racana — agent notes

## Verify
- `npx tsc --noEmit -p .` — typecheck
- `npx vitest run` — full suite (~2.5 min; renders real PDFs with bin/typst). A Postgres at localhost:5432 is optional; DB-backed tests fall back.
- `npm run build:worker` — bundles the queue worker to `dist/worker.cjs` (esbuild). The Fly worker runs this file; never run `.ts` with a loader in production.

## Engine facts
- Typst 0.11.1 is pinned (`bin/typst`, `bin/typst.exe`, Dockerfiles). Templates in `src/lib/renderer/typst/templates/*.typ` must stay tracked in git (`tests/templates-tracked.test.ts`).
- Containers need Node 20+ (pdfjs-dist 5).
- `book_settings` style columns are nullable overrides: NULL = template value. Never give them DB defaults.
- Interior bleed is fixed at 0.125″ (outside edge + top/bottom); QA expects that page size.
- Covers must never print invented text: no default ISBN/blurb/bio/publisher; the KDP barcode area stays clear.
