import type { Color } from './types'
import { localDateKey } from './dates'
import { isColor } from './palette'

/*
 * Keeps an Auto Practice session going across app restarts (iOS often
 * reloads a home-screen app that was in the background). This is temporary
 * screen state, not user data, so it lives in localStorage rather than the
 * database, and only for the day it started. Never touches the legacy
 * `practice:*` keys.
 */

export interface SessionEntry {
  name: string
  colorBefore: Color
  colorAfter: Color
}

export interface SavedSession {
  /** Local 'YYYY-MM-DD' the session belongs to. */
  day: string
  tags: string[]
  colors: Color[]
  advanced: string | null
  skipped: string[]
  sessionLog: SessionEntry[]
  /** The item on screen, or null between items. */
  currentItemId: string | null
}

const key = (activityId: string) => `practice-app:auto-session:${activityId}`

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string')

function isEntry(v: unknown): v is SessionEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return typeof e.name === 'string' && isColor(e.colorBefore) && isColor(e.colorAfter)
}

function isSavedSession(v: unknown): v is SavedSession {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return typeof s.day === 'string' && isStrings(s.tags) && Array.isArray(s.colors) && s.colors.every(isColor) &&
    (s.advanced === null || typeof s.advanced === 'string') && isStrings(s.skipped) &&
    Array.isArray(s.sessionLog) && s.sessionLog.every(isEntry) &&
    (s.currentItemId === null || typeof s.currentItemId === 'string')
}

export function saveSession(activityId: string, session: SavedSession): void {
  try {
    localStorage.setItem(key(activityId), JSON.stringify(session))
  } catch {
    // Storage unavailable: the session just won't survive a restart.
  }
}

/** Today's saved session for the activity, or null. Another day's session is discarded. */
export function loadSession(activityId: string, today: string = localDateKey(new Date())): SavedSession | null {
  try {
    const raw = localStorage.getItem(key(activityId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSavedSession(parsed)) return null
    if (parsed.day !== today) {
      clearSession(activityId)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearSession(activityId: string): void {
  try {
    localStorage.removeItem(key(activityId))
  } catch {
    // Nothing to do.
  }
}
