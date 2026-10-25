import { describe, it, expect, vi, afterEach } from 'vitest'
import { saveSession, loadSession, clearSession, type SavedSession } from '../sessionResume'

const session = (o: Partial<SavedSession> = {}): SavedSession => ({
  day: '2026-10-25', tags: ['V3'], colors: ['red'], advanced: null, skipped: ['x'],
  sessionLog: [{ name: 'Box', colorBefore: 'red', colorAfter: 'green' }], currentItemId: 'a', ...o,
})

describe('session resume storage', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('round-trips a session for the same day', () => {
    saveSession('act-1', session())
    expect(loadSession('act-1', '2026-10-25')).toEqual(session())
    expect(loadSession('act-2', '2026-10-25')).toBeNull()
  })

  it("discards another day's session", () => {
    saveSession('act-1', session({ day: '2026-10-24' }))
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
    expect(localStorage.getItem('practice-app:auto-session:act-1')).toBeNull()
  })

  it('treats damaged data as nothing to resume', () => {
    localStorage.setItem('practice-app:auto-session:act-1', '{oops')
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
    localStorage.setItem('practice-app:auto-session:act-1', JSON.stringify({ day: '2026-10-25', tags: 'V3' }))
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
  })

  it('clearSession removes it', () => {
    saveSession('act-1', session())
    clearSession('act-1')
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(() => saveSession('act-1', session())).not.toThrow()
    expect(loadSession('act-1', '2026-10-25')).toBeNull()
  })

  it('never touches the legacy practice: keys', () => {
    saveSession('act-1', session())
    expect(Object.keys(localStorage).filter(k => k.startsWith('practice:'))).toEqual([])
  })
})
