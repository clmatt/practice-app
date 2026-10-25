export function generateId(): string {
  return crypto.randomUUID()
}

/** A copy of `set` with `value` added if it was missing, removed if it was there. */
export function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}
