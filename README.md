# Practice App

A personal practice tracker that runs as an app on your phone's home screen.

**Live app:** https://clmatt.github.io/practice-app/

You create **activities** (e.g. "Juggling"), add **items** to each (e.g. individual tricks), and after practising an item you rate it red, yellow or green. Auto Practice draws items weighted towards the ones you struggle with and the ones you haven't touched in a while. Tapped the wrong color? An *Undo* bar appears for a few seconds after each save. Stats show how your ratings shift over time.

## Using it

**Install on iPhone:** open the live app in Safari → Share → *Add to Home Screen*. It works offline after the first load and updates itself when a new version is deployed (close and reopen it to pick up an update).

**Your data lives only on your phone** (in the browser's IndexedDB storage for the app's web address). There's no account or server. That means:

- **Back up regularly.** Home screen → *Export data*. On iPhone this opens the share sheet — choose *Save to Files* (iCloud Drive is a good spot). The Home screen shows when you last backed up and turns amber after 30 days.
- **Restore / move to a new phone:** install the app, then Home → *Import data* and pick a backup file. If an activity already exists you'll be asked whether to keep existing, replace, keep both, or combine.
- The data is tied to the address `clmatt.github.io/practice-app`. Renaming the GitHub account or repository changes the address, and the app at the new address starts empty — export first, then import at the new address.
- Clearing Safari's website data for the site deletes the data. The app asks the browser to keep its storage persistent, but a backup is the only real guarantee.

## Developing

Requires **Node 24** (see `.nvmrc`; with nvm: `nvm use`).

```bash
npm ci            # install exact dependency versions from package-lock.json
npm run dev       # dev server → http://localhost:5173/practice-app/
npm test          # run the test suite once (Vitest)
npm run lint      # ESLint
npm run build     # type-check and production build into dist/
npm run preview   # serve the production build locally
npm run icons     # regenerate public/icon-*.png from scripts/generate-icons.mjs
```

`src/tests/` (covering storage, migrations, backup and the UI safety nets) is the safety net — make sure `npm test` is green before pushing to `main`.

The dev server uses a separate storage area from the live app (different address), so testing locally never touches your real data.

### Deploying

Push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) runs lint, tests and the build, and deploys to GitHub Pages only if all pass. Pushes to other branches run the same checks without deploying. Check progress at https://github.com/clmatt/practice-app/actions.

### Coming back after a long break

1. `nvm use` (or install Node 24), then `npm ci`.
2. `npm test && npm run lint && npm run build` — everything should pass before you change anything.
3. If `npm ci` or the build fails because the toolchain has aged, that's the moment to update dependencies (`npm outdated`, then update and re-run the checks). The deployed app is static files and keeps working regardless.
4. If the GitHub Actions deploy starts failing with deprecation errors, bump the action versions in `deploy.yml` to their current majors.
5. Never deploy or roll back to a version from before the IndexedDB move (September 2026) — export a backup first, since an old version would show only the frozen pre-move localStorage copy and anything saved during the rollback wouldn't carry forward; roll forward with a fix instead.

## How it works

**Stack:** React 19, TypeScript, React Router 7 (hash routing, so it works on GitHub Pages), Tailwind CSS 3, Recharts, Vite, vite-plugin-pwa.

```
src/
  main.tsx            starts storage, then renders the app
  App.tsx             routes, crash screen, storage-error banner
  types.ts            data model: Activity, Item, PracticeLog, SavedFilter
  storage.ts          all reads/writes + stats queries (in-memory, saved to IndexedDB)
  db.ts               thin IndexedDB wrapper (only storage.ts uses it)
  migrations.ts       data schema version + upgrade steps
  backup.ts           export/import file format and import conflict handling
  dates.ts            local-calendar-date helpers
  autoPractice.ts     what Auto Practice draws next (filters, skips, done states)
  itemList.ts         search, sort and filters for the Items list (kept in the URL)
  selection.ts        weighted random choice for Auto Practice
  filterParser.ts     advanced tag filter expressions ("a" && !("b" || "c"))
  tabs.ts / itemRuns.ts / utils.ts   small helpers (active tab from route, color-streak grouping, id generation)
  screens/            one component per route
  components/         shared UI
  tests/              Vitest tests
docs/superpowers/     design specs and implementation plans from past work
```

**Storage:** on startup everything is loaded from IndexedDB into memory; reads are instant, and writes are saved in the background. If a save fails (e.g. the phone is out of space) a red banner offers an export. Versions before September 2026 kept data in `localStorage`; the first launch of a newer version copies it into IndexedDB automatically and leaves the old copy in place as a safety net.

**Changing the data model:** if you change `types.ts` in a way that old saved data or old backup files wouldn't match, bump `CURRENT_SCHEMA_VERSION` in `src/migrations.ts` and add a migration step with a test. Adding a new *optional* field doesn't need a migration.

**Dates:** timestamps are stored in UTC; anything grouped "by day" uses the phone's local date via `src/dates.ts`.
