# Practice App

A personal practice tracking app designed to run as a PWA on your phone's home screen.

## What It Does

Practice App helps you track progress across anything you're working to improve — juggling tricks, climbing routes, musical pieces, language vocabulary, or any other skill with discrete items to practice.

You create **activities** (e.g. "Juggling"), add **items** to each one (e.g. individual tricks), and rate each item red, yellow, or green after practicing it. The app uses those ratings to weight which items get drawn during practice sessions — items you struggle with come up more often, items you've mastered come up less.

Over time, the stats view shows how your color distribution shifts as you improve.

## Technical

**Stack:** React 19, TypeScript, React Router v7, Tailwind CSS v3, Recharts, Vite

**Storage:** All data lives in `localStorage` — no backend, no accounts.

**PWA:** Built with `vite-plugin-pwa`. Add to your iPhone home screen via Safari's share menu for a native-feeling experience with safe-area insets and no browser chrome.

**Deployed to:** GitHub Pages via `gh-pages`

### Commands

```bash
npm run dev       # Start dev server
npm run build     # Type-check and build for production
npm test          # Run test suite (Vitest)
npm run deploy    # Build and push to gh-pages branch
```
