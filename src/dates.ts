/**
 * Calendar dates in the device's local timezone.
 *
 * Timestamps are stored as UTC ISO strings. Never use iso.slice(0, 10) to get
 * "the day" — that's the UTC date, which for US evenings is already tomorrow.
 */

/** 'YYYY-MM-DD' for the local calendar day containing `value`. */
export function localDateKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Whole calendar days from `from` to `to` (both 'YYYY-MM-DD'); positive if `to` is later. */
export function daysBetweenKeys(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

/** Formats a 'YYYY-MM-DD' key for display (en-US), e.g. "May 15, 2026". */
export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(key + 'T00:00:00').toLocaleDateString('en-US', options)
}
