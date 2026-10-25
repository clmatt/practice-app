# Practice App — notes for Claude

Personal PWA (React 19 + TypeScript + Vite + Tailwind 3) for tracking practice of items rated red/yellow/green. Single user, iPhone home-screen app, no backend. See README.md for the product and layout.

## Product philosophy (check every feature idea against this)
The owner's words, condensed. Proposals that conflict with these are out, however standard they are elsewhere (Anki, Duolingo, habit apps).
- **Never coerce practice.** Not practising — for a day or a month — is a legitimate choice, sometimes the right one. No streaks, due counts, overdue piles, reminders, "you haven't practised in N days" pressure, or anything that turns a break into a debt or a source of guilt.
- **The model is the latest rating, not time.** An item's colour is how it went the last time you practised it. If a break makes you worse, that shows up in your next rating — that's the only consequence. Selection never depends on dates or elapsed time (recency bias uses the *order* items were practised in, not how long ago). No forgetting curves or spaced-repetition scheduling.
- **You choose the session.** What to work on — colours, tags, filters, picking items by hand — is the user's call. The app suggests; it doesn't dictate what a session must contain.
- **Built for the owner's physical-skill practice** (juggling, climbing), where "how did it go last time" is the right model. It may or may not suit things like vocabulary; that's fine. Design for these use cases rather than generalising at their expense.

## Commands
- `npm test` (Vitest, jsdom, fake-indexeddb, timezone pinned to America/Los_Angeles)
- `npm run lint` — must report 0 problems
- `npm run build` — type-check (`tsc -b`) + production build
- `npm run test:e2e` — Playwright in WebKit against the production build (run `npm run build` first)
- `npm run dev` → http://localhost:5173/practice-app/
- Node 24 (`.nvmrc`, `engines` in package.json)

## Deploying
Pushing `main` deploys to the user's phone via GitHub Actions (`.github/workflows/deploy.yml` runs lint + test + build on every push, deploys only from `main`). Do feature work on a branch; merge to `main` only when checks pass. The owner's standing preference: push after committing without asking. Green Dependabot pull requests merge and deploy themselves (`automerge` job; rules in `scripts/dependabot-automerge-policy.ts`); npm majors are left for the owner — don't loosen that without asking. Never deploy or roll back to a version from before the IndexedDB move (September 2026) — export a backup first; an old version would show only the frozen pre-move localStorage copy, and anything saved during the rollback wouldn't carry forward.

## Rules that protect the user's data
- All data access goes through `src/storage.ts`. Reads are synchronous from an in-memory cache; writes update memory and queue an IndexedDB save (`src/db.ts`). Never mutate `state` arrays in place; getters return copies.
- `main.tsx` awaits `initStorage()` before rendering; a rejection renders `StartupErrorScreen` instead. Tests get a fresh database per test via `src/tests/setup.ts`.
- Changing the stored data shape (anything in `src/types.ts` that old data or old backup files won't satisfy) requires bumping `CURRENT_SCHEMA_VERSION` and adding a step to `MIGRATIONS` in `src/migrations.ts`, with a test. New optional fields don't.
- Never delete or write the legacy localStorage keys (`practice:activities`, `practice:items`, `practice:logs`, `practice:saved-filters`). They're a fallback copy of pre-IndexedDB data, read once on first start with an empty database.
- Export files (`src/backup.ts`) must stay importable forever: keep accepting old files (no `schemaVersion` → version 1).
- Group by day with `localDateKey()` from `src/dates.ts`, never `iso.slice(0, 10)` (that's the UTC date).
- Save a practice rating with `recordPractice()` (log + new colour in one transaction), never `appendLog` + `saveItem`. `saveItem()` records a colour change as an edit log (`source: 'edit'`); anything that counts practice must skip those with `isRep()` from `src/logs.ts` (storage's own queries already do).
- Items are archived (`archivedAt`), not deleted, from the UI. Practice, the dashboard and tag pickers use `getActiveItems()`; history and stats keep archived items (`getItems()`).
- Auto Practice resume state lives in localStorage under `practice-app:auto-session:<activityId>` (`src/sessionResume.ts`). It's disposable screen state, not user data.

## Conventions
- The production build has a strict Content-Security-Policy (`vite.config.ts`): no inline scripts or styles in HTML, nothing loaded from or sent to other origins. e2e fails on any violation; change the policy deliberately if a feature truly needs it.
- 2-space indent, no semicolons, single quotes; Tailwind utility classes; slate background, violet accents.
- `tsconfig.app.json` has `erasableSyntaxOnly: true`: no enums, namespaces or constructor parameter properties.
- Only components are exported from `.tsx` files (`react-refresh/only-export-components` lint rule); put helpers in `.ts` modules.
- Screens read storage directly in `useState` initialisers; effects are only for redirects (`react-hooks/set-state-in-effect` is enforced).
- Rating colors come from `RATING_COLORS` in `src/palette.ts` — never hard-code red/yellow/green hex values or Tailwind color classes for ratings. (Green is emerald on purpose: it was chosen with a colour-blindness validator.) List or order the ratings with `RATINGS`/`RATING_ORDER`, never a hand-written `['red', 'yellow', 'green']`.
- Plural item labels come from `pluralLabel(activity)` (`src/labels.ts`), never `${itemLabel}s`.
- Activity screens get their activity (and the redirect when it's missing) from `useActivity()`.
- Wording: a **rep** is one rating; a **session** is a practice day.
- Show tags with `components/TagList` (labels) or `components/ToggleChip` (selectable); sort tags/names with `sortTags`/`compareNatural` from `src/sorting.ts`, never plain `.sort()`.
- Design specs and plans live in `docs/superpowers/`.
