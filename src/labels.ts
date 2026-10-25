import type { Activity } from './types'

/** English plural: category → categories, box → boxes, trick → tricks. Keeps an all-caps word all caps. */
export function pluralize(word: string): string {
  const w = word.trim()
  if (w === '') return w
  const upper = w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase()
  const suffix = (s: string) => (upper ? s.toUpperCase() : s)
  if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + suffix('ies')
  if (/(s|x|z|ch|sh)$/i.test(w)) return w + suffix('es')
  return w + suffix('s')
}

/** The activity's items in the plural ("tricks"), using its override when set. */
export function pluralLabel(activity: Pick<Activity, 'itemLabel' | 'itemLabelPlural'>): string {
  return activity.itemLabelPlural?.trim() || pluralize(activity.itemLabel)
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
