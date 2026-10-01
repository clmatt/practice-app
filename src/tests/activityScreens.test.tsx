import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import HomeScreen from '../screens/HomeScreen'
import ActivityDashboardScreen from '../screens/ActivityDashboardScreen'
import { saveActivity, saveItem, getActivities, getSnapshot } from '../storage'

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/activity/:activityId" element={<ActivityDashboardScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

function seed() {
  saveActivity({ id: 'act-1', name: 'Juggling', itemLabel: 'trick', weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z' })
  saveItem({ id: 'i1', activityId: 'act-1', name: 'Box', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' })
}

describe('deleting an activity', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('is not offered on the Home screen cards', () => {
    seed()
    renderAt('/')
    expect(screen.getByText('Juggling')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('lives in Activity Settings, asks first, and returns Home', () => {
    seed()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/activity/act-1')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete activity' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Juggling'))
    expect(getActivities()).toEqual([])
    expect(getSnapshot().items).toEqual([])
    expect(screen.getByText('No activities yet. Add one to get started.')).toBeInTheDocument()
  })

  it('does nothing when the confirmation is cancelled', () => {
    seed()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt('/activity/act-1')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete activity' }))
    expect(getActivities()).toHaveLength(1)
  })
})
