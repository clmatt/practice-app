import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveActivity, saveItem, appendLog } from '../storage'
import { exportData } from '../utils'
import type { Activity, Item, PracticeLog } from '../types'

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  name: 'Juggling',
  itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 },
  createdAt: '2026-05-16T00:00:00.000Z',
  ...overrides,
})

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  activityId: 'act-1',
  name: 'Mills Mess',
  color: 'red',
  createdAt: '2026-05-16T00:00:00.000Z',
  ...overrides,
})

const makeLog = (overrides: Partial<PracticeLog> = {}): PracticeLog => ({
  id: 'log-1',
  itemId: 'item-1',
  practicedAt: '2026-05-16T10:00:00.000Z',
  colorBefore: 'red',
  colorAfter: 'yellow',
  ...overrides,
})

describe('exportData', () => {
  let clickedHref: string | undefined
  let clickedDownload: string | undefined

  beforeEach(() => {
    clickedHref = undefined
    clickedDownload = undefined

    // Mock URL.createObjectURL and URL.revokeObjectURL
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => 'blob:mock-url',
      revokeObjectURL: vi.fn(),
    })

    // Capture the <a> element click
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') {
        vi.spyOn(el, 'click').mockImplementation(() => {
          clickedHref = (el as HTMLAnchorElement).href
          clickedDownload = (el as HTMLAnchorElement).download
        })
      }
      return el
    })
  })

  it('triggers a download with all activities, items, and logs', () => {
    saveActivity(makeActivity())
    saveItem(makeItem())
    appendLog(makeLog())

    exportData()

    expect(clickedDownload).toMatch(/^practice-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect(clickedHref).toBeDefined()
  })

  it('includes exportedAt timestamp in the payload', () => {
    let capturedBlob: Blob | undefined
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => { capturedBlob = blob; return 'blob:mock-url' },
      revokeObjectURL: vi.fn(),
    })

    exportData()

    expect(capturedBlob).toBeDefined()
    capturedBlob!.text().then(text => {
      const parsed = JSON.parse(text)
      expect(parsed.exportedAt).toBeDefined()
      expect(parsed.activities).toBeInstanceOf(Array)
      expect(parsed.items).toBeInstanceOf(Array)
      expect(parsed.logs).toBeInstanceOf(Array)
    })
  })
})
