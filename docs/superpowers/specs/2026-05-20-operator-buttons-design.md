# Operator Buttons in Advanced Filter Modal

**Date:** 2026-05-20
**Status:** Approved

## Overview

Add a row of operator buttons to `AdvancedFilterModal` so users can insert `&&`, `||`, `!`, `(`, and `)` at the cursor position without typing them manually. Same insertion mechanism as existing tag chips.

---

## Changes

### `src/components/AdvancedFilterModal.tsx` only

**Refactor `insertTag` → `insertSnippet`**

Rename `insertTag` to `insertSnippet(text: string)` where `text` is inserted verbatim at the cursor. Tag chips call it as `insertSnippet(`"${tag}"`)`. Operator buttons call it directly with the operator string.

**Operator insertion values**

| Button label | String inserted |
|---|---|
| `&&` | ` && ` |
| `\|\|` | ` \|\| ` |
| `!` | `!` |
| `(` | `(` |
| `)` | `)` |

`&&` and `||` include a leading and trailing space for readability. `!`, `(`, `)` do not.

**New UI section**

Add an "Operators" section directly above the existing "Tap to insert tag" section. Same label style (`text-xs text-slate-500 uppercase tracking-wider`). Buttons use the same size/shape as tag chips but with a distinct style to visually separate syntax from content:

```tsx
<div className="flex flex-col gap-2">
  <p className="text-xs text-slate-500 uppercase tracking-wider">Operators</p>
  <div className="flex gap-2">
    {(['&&', '||', '!', '(', ')'] as const).map(op => (
      <button
        key={op}
        onClick={() => insertSnippet(op === '&&' ? ' && ' : op === '||' ? ' || ' : op)}
        className="bg-slate-900 border border-slate-600 hover:border-violet-500 text-slate-300 hover:text-violet-400 rounded-lg px-3 py-1 text-xs font-mono transition-colors"
      >
        {op}
      </button>
    ))}
  </div>
</div>
```

---

## Out of Scope

- No changes to parser, storage, or any other file
- No keyboard shortcut support
