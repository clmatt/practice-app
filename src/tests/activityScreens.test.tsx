import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
        <Route path="/activity/:activityId/practice-chooser" element={<p>practice chooser</p>} />
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

describe('draw settings', () => {
  function openSettings() {
    seed()
    renderAt('/activity/act-1')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  }

  it('offers "needs the most work" in the main settings, on at 4 by default, explained live, and saves it', () => {
    openSettings()
    const work = screen.getByLabelText('Favor items that need the most work')
    expect(work).toHaveValue('4')
    expect(screen.getByText(/up to 5× as likely to be picked/)).toBeInTheDocument()
    fireEvent.change(work, { target: { value: '0' } })
    expect(screen.getByText(/Off: within a color/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(getActivities()[0].workBias).toBe(0)
  })

  it('keeps recency bias, rating memory and the plural under a collapsed Advanced section', () => {
    openSettings()
    const advanced = screen.getByText('Advanced').closest('details')!
    expect(advanced).not.toHaveAttribute('open')
    expect(within(advanced).getByLabelText('Recency bias')).toBeInTheDocument()
    expect(within(advanced).getByLabelText('Rating memory')).toBeInTheDocument()
    expect(within(advanced).getByLabelText('Plural (optional)')).toBeInTheDocument()
  })

  it('explains recency bias and rating memory live, and saves them', () => {
    openSettings()
    expect(screen.getByText(/about 2\.6× as likely to be picked/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Recency bias'), { target: { value: '1' } })
    expect(screen.getByText(/equally likely to be picked/)).toBeInTheDocument()
    const memory = screen.getByLabelText('Rating memory')
    expect(memory).toHaveValue('3')
    expect(screen.getByText(/from 3 reps ago counts half/)).toBeInTheDocument()
    fireEvent.change(memory, { target: { value: '5' } })
    expect(screen.getByText(/from 5 reps ago counts half/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(getActivities()[0]).toMatchObject({ recencyBias: 1, ratingMemory: 5 })
  })
})

describe('dashboard', () => {
  it('has a Practice button that opens the Auto/Manual choice', () => {
    seed()
    renderAt('/activity/act-1')
    fireEvent.click(screen.getByRole('link', { name: 'Practice' }))
    expect(screen.getByText('practice chooser')).toBeInTheDocument()
  })
})
