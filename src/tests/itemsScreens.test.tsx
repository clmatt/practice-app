import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import ManageItemsScreen from '../screens/ManageItemsScreen'
import ItemProgressScreen from '../screens/ItemProgressScreen'
import AddEditItemScreen from '../screens/AddEditItemScreen'
import { saveActivity, saveItem, appendLog } from '../storage'
import type { Activity, Item } from '../types'

const activity: Activity = {
  id: 'act-1', name: 'Juggling', itemLabel: 'trick',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z',
}

const item = (id: string, name: string, o: Partial<Item> = {}): Item => ({
  id, activityId: 'act-1', name, color: 'red', createdAt: '2026-01-01T00:00:00.000Z', ...o,
})

function seed() {
  saveActivity(activity)
  saveItem(item('a', 'Mills Mess', { color: 'red', tags: ['3-ball', 'hard'] }))
  saveItem(item('b', 'Box', { color: 'green', tags: ['3-ball'] }))
  appendLog({ id: 'l1', itemId: 'a', practicedAt: '2026-09-20T18:00:00.000Z', colorBefore: 'red', colorAfter: 'red' })
  appendLog({ id: 'l2', itemId: 'a', practicedAt: '2026-09-21T18:00:00.000Z', colorBefore: 'red', colorAfter: 'red' })
}

/** Stands in for the phone's back gesture. */
function BackButton() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Back (test)</button>
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/activity/:activityId/manage" element={<ManageItemsScreen />} />
        <Route path="/activity/:activityId/manage/add" element={<AddEditItemScreen key="add" />} />
        <Route path="/activity/:activityId/manage/:itemId" element={<><ItemProgressScreen /><BackButton /></>} />
        <Route path="/activity/:activityId/manage/:itemId/edit" element={<AddEditItemScreen key="edit" />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const rows = () => screen.getAllByRole('listitem')

describe('Items list', () => {
  it('shows each item with its tags and practice summary', () => {
    seed()
    renderAt('/activity/act-1/manage')
    const mills = within(rows().find(r => r.textContent!.includes('Mills Mess'))!)
    expect(mills.getByText('hard')).toBeInTheDocument()
    expect(mills.getByText('Last practiced September 21 · 2 sessions')).toBeInTheDocument()
    const box = within(rows().find(r => r.textContent!.includes('Box'))!)
    expect(box.getByText('Never practiced')).toBeInTheDocument()
  })

  it('sorts with the sort menu', () => {
    seed()
    renderAt('/activity/act-1/manage')
    expect(rows().map(r => r.textContent)).toEqual([expect.stringContaining('Box'), expect.stringContaining('Mills Mess')])
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'practiced-recent' } })
    expect(rows().map(r => r.textContent)).toEqual([expect.stringContaining('Mills Mess'), expect.stringContaining('Box')])
  })

  it('keeps color and tag filters behind a Filter button that shows how many are active', () => {
    seed()
    renderAt('/activity/act-1/manage')
    expect(screen.queryByRole('button', { name: 'hard' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    fireEvent.click(screen.getByRole('button', { name: 'hard' }))
    expect(rows()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Filter (1)' })).toBeInTheDocument()
  })

  it('opens filtered to a color when linked from the dashboard', () => {
    seed()
    renderAt('/activity/act-1/manage?color=green')
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Box')
    expect(screen.getByRole('button', { name: 'Filter (1)' })).toBeInTheDocument()
  })

  it('keeps search, sort and filters when coming back from an item', () => {
    seed()
    saveItem(item('c', 'Mills Shower', { color: 'yellow', tags: ['hard'] }))
    renderAt('/activity/act-1/manage?color=green')
    fireEvent.click(screen.getByRole('button', { name: 'Filter (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    fireEvent.click(screen.getByRole('button', { name: 'hard' }))
    fireEvent.change(screen.getByPlaceholderText('Search tricks'), { target: { value: 'mills' } })
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name-desc' } })
    expect(rows().map(r => r.textContent)).toEqual([expect.stringContaining('Mills Shower'), expect.stringContaining('Mills Mess')])

    fireEvent.click(screen.getByText('Mills Shower'))
    fireEvent.click(screen.getByRole('button', { name: 'Back (test)' }))

    expect(screen.getByPlaceholderText('Search tricks')).toHaveValue('mills')
    expect(screen.getByLabelText('Sort by')).toHaveValue('name-desc')
    expect(screen.getByRole('button', { name: 'Filter (1)' })).toBeInTheDocument()
    expect(rows().map(r => r.textContent)).toEqual([expect.stringContaining('Mills Shower'), expect.stringContaining('Mills Mess')])
  })

  it("tapping an item opens its page, whose Edit button opens the editor, and saving returns to the item's page", () => {
    seed()
    renderAt('/activity/act-1/manage')
    fireEvent.click(screen.getByText('Mills Mess'))
    expect(screen.getByText(/Currently red/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByDisplayValue('Mills Mess'), { target: { value: "Mills' Mess" } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByRole('heading', { name: "Mills' Mess" })).toBeInTheDocument()
    expect(screen.getByText(/Currently red/)).toBeInTheDocument()
  })
})
