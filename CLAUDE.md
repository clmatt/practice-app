# Practice App — notes for Claude

Personal PWA (React 19 + TypeScript + Vite + Tailwind 3) for tracking practice of items rated red/yellow/green. Single user, iPhone home-screen app, no backend. See README.md for the product and layout.

## Commands
- `npm test` (Vitest, jsdom, fake-indexeddb, timezone pinned to America/Los_Angeles)
- `npm run lint` — must report 0 problems
- `npm run build` — type-check (`tsc -b`) + production build
- `npm run dev` → http://localhost:5173/practice-app/
- Node 24 (`.nvmrc`, `engines` in package.json)

## Deploying
Pushing `main` deploys to the user's phone via GitHub Actions (`.github/workflows/deploy.yml` runs lint + test + build on every push, deploys only from `main`). Do feature work on a branch; merge to `main` only when checks pass. The owner's standing preference: push after committing without asking. Never deploy or roll back to a version from before the IndexedDB move (September 2026) — export a backup first; an old version would show only the frozen pre-move localStorage copy, and anything saved during the rollback wouldn't carry forward.

## Rules that protect the user's data
- All data access goes through `src/storage.ts`. Reads are synchronous from an in-memory cache; writes update memory and queue an IndexedDB save (`src/db.ts`). Never mutate `state` arrays in place; getters return copies.
- `main.tsx` awaits `initStorage()` before rendering; a rejection renders `StartupErrorScreen` instead. Tests get a fresh database per test via `src/tests/setup.ts`.
- Changing the stored data shape (anything in `src/types.ts` that old data or old backup files won't satisfy) requires bumping `CURRENT_SCHEMA_VERSION` and adding a step to `MIGRATIONS` in `src/migrations.ts`, with a test. New optional fields don't.
- Never delete or write the legacy localStorage keys (`practice:activities`, `practice:items`, `practice:logs`, `practice:saved-filters`). They're a fallback copy of pre-IndexedDB data, read once on first start with an empty database.
- Export files (`src/backup.ts`) must stay importable forever: keep accepting old files (no `schemaVersion` → version 1).
- Group by day with `localDateKey()` from `src/dates.ts`, never `iso.slice(0, 10)` (that's the UTC date).

## Conventions
- 2-space indent, no semicolons, single quotes; Tailwind utility classes; slate background, violet accents.
- `tsconfig.app.json` has `erasableSyntaxOnly: true`: no enums, namespaces or constructor parameter properties.
- Only components are exported from `.tsx` files (`react-refresh/only-export-components` lint rule); put helpers in `.ts` modules.
- Screens read storage directly in `useState` initialisers; effects are only for redirects (`react-hooks/set-state-in-effect` is enforced).
- Design specs and plans live in `docs/superpowers/`.
