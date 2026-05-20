import { describe, it, expect } from 'vitest'
import { getActiveTab } from '../components/TabBar'

describe('getActiveTab', () => {
  const id = 'abc123'

  it('returns home for the activity root', () => {
    expect(getActiveTab(`/activity/${id}`, id)).toBe('home')
  })

  it('returns practice for practice-chooser', () => {
    expect(getActiveTab(`/activity/${id}/practice-chooser`, id)).toBe('practice')
  })

  it('returns items for manage root', () => {
    expect(getActiveTab(`/activity/${id}/manage`, id)).toBe('items')
  })

  it('returns items for manage sub-routes', () => {
    expect(getActiveTab(`/activity/${id}/manage/add`, id)).toBe('items')
    expect(getActiveTab(`/activity/${id}/manage/item1`, id)).toBe('items')
    expect(getActiveTab(`/activity/${id}/manage/item1/edit`, id)).toBe('items')
  })

  it('returns stats for stats route', () => {
    expect(getActiveTab(`/activity/${id}/stats`, id)).toBe('stats')
  })

  it('returns stats for stats with query params', () => {
    expect(getActiveTab(`/activity/${id}/stats?tab=items&color=red`, id)).toBe('stats')
  })
})
