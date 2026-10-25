import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../backup', async importOriginal => {
  const actual = await importOriginal<typeof import('../backup')>()
  return { ...actual, exportData: vi.fn() }
})

import { exportData } from '../backup'
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

  function openDelete() {
    seed()
    renderAt('/activity/act-1')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete activity' }))
  }

  it('lives in Activity Settings, says what will be removed, and can delete without a backup', () => {
    openDelete()
    expect(screen.getByText(/Deletes "Juggling", its 1 trick and 0 reps\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete without backup' }))
    expect(getActivities()).toEqual([])
    expect(getSnapshot().items).toEqual([])
    expect(screen.getByText('No activities yet. Add one to get started.')).toBeInTheDocument()
  })

  it('exports first, then deletes', async () => {
    vi.mocked(exportData).mockResolvedValue(true)
    openDelete()
    fireEvent.click(screen.getByRole('button', { name: 'Export backup, then delete' }))
    expect(await screen.findByText('No activities yet. Add one to get started.')).toBeInTheDocument()
    expect(exportData).toHaveBeenCalled()
  })

  it('does nothing when the export is cancelled', async () => {
    vi.mocked(exportData).mockResolvedValue(false)
    openDelete()
    fireEvent.click(screen.getByRole('button', { name: 'Export backup, then delete' }))
    await waitFor(() => expect(exportData).toHaveBeenCalled())
    expect(getActivities()).toHaveLength(1)
  })

  it('shows the error and keeps everything when the export fails', async () => {
    vi.mocked(exportData).mockRejectedValue(new Error('disk full'))
    openDelete()
    fireEvent.click(screen.getByRole('button', { name: 'Export backup, then delete' }))
    expect(await screen.findByText("Couldn't export: disk full")).toBeInTheDocument()
    expect(getActivities()).toHaveLength(1)
  })

  it('Cancel keeps everything', () => {
    openDelete()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(getActivities()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Delete activity' })).toBeInTheDocument()
  })
})

describe('item label plural', () => {
  it('shows automatic plurals and saves an override from Settings', () => {
    saveActivity({ id: 'act-1', name: 'Cooking', itemLabel: 'dish', weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z' })
    renderAt('/activity/act-1')
    expect(screen.getByText('dishes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const plural = screen.getByLabelText('Plural (optional)')
    expect(plural).toHaveAttribute('placeholder', 'dishes')
    fireEvent.change(plural, { target: { value: 'meals' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(getActivities()[0].itemLabelPlural).toBe('meals')
    expect(screen.getByText('meals')).toBeInTheDocument()
  })
})

describe('Home', () => {
  it('shows the app version', () => {
    renderAt('/')
    expect(screen.getByText(/^Version \S+ · \w{3} \d{1,2}, \d{4}$/)).toBeInTheDocument()
  })
})
