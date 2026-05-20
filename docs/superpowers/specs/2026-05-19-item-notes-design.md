# Item Notes — Design Spec
**Date:** 2026-05-19

## Overview

Add the ability to attach an optional text note to any practice session. Notes are stored on `PracticeLog` entries so they are naturally dated and tied to the session in which they were written. They are viewable during practice (draw phase context, rate phase input) and on the item detail screen.

## Data Model

Add `note?: string` to the `PracticeLog` interface in `types.ts`. No new storage key is required — `appendLog` already accepts the full log object, so notes travel with existing export/import automatically.

New storage helper in `storage.ts`:

```ts
export function getNotesForItem(itemId: string): { practicedAt: string; note: string }[] 
```

Returns all log entries for the item that have a non-empty note, sorted newest-first. Used wherever past notes are displayed.

## Draw Phase (`PracticeSessionScreen`)

Past notes for the current item are shown below the color reveal area — a compact read-only list, each entry showing a formatted date and the note text. Rendered only when the item has at least one note. Provides context before the user decides to practice.

## Rate Phase (`PracticeSessionScreen` + `ManualPracticeScreen`)

An optional textarea is added between the ColorPicker and the Save button:
- Placeholder: "Add a note (optional)"
- On Save: note is trimmed; if non-empty it is included in the `appendLog` call; if empty the `note` field is omitted entirely
- Past notes are not repeated here (already visible one screen back in the draw phase)
- State: `noteText: string`, reset to `''` after each save

## `ItemProgressScreen`

A "Notes" section is rendered below the color run chart, only when `getNotesForItem` returns at least one entry. Each entry shows:
- Date formatted as month + day + year (matching `formatDate` style used elsewhere in the app)
- Note text below the date

Entries are ordered newest-first.

## What This Does Not Include

- Notes are not editable or deletable after saving
- Notes cannot be added outside of a practice session (no standalone note entry)
- No note display in the session summary (Stats → By session expanded view)
