// Text ordering for tags and item names: numbers inside text sort by value,
// so grades come out V1, V2, … V10 rather than V1, V10, V2.
const collator = new Intl.Collator(undefined, { numeric: true })

export function compareNatural(a: string, b: string): number {
  return collator.compare(a, b)
}

/** Unique tags in natural order. */
export function sortTags(tags: Iterable<string>): string[] {
  return [...new Set(tags)].sort(compareNatural)
}
