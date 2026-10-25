import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ManualPracticeScreen from '../screens/ManualPracticeScreen'
import { saveActivity, saveItem, getLogs, getItems } from '../storage'

function seed() {
  saveActivity({ id: 'act-1', name: 'Juggling', itemLabel: 'trick', weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z' })
  saveItem({ id: 'a', activityId: 'act-1', name: 'Box', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' })
  saveItem({ id: 'b', activityId: 'act-1', name: 'Mills Mess', color: 'yellow', createdAt: '2026-01-01T00:00:00.000Z' })
}

function renderScreen() {
  render(
    <MemoryRouter initialEntries={['/activity/act-1/manual-practice']}>
      <Routes>
        <Route path="/activity/:activityId/manual-practice" element={<ManualPracticeScreen />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('Manual Practice', () => {
  it('rating an item saves one rep with the note and updates its colour', () => {
    seed()
    renderScreen()
    click(/Box/)
    click('Solid')
    fireEvent.change(screen.getByPlaceholderText('Add a note (optional)'), { target: { value: 'clean' } })
    click('Save')
    expect(getLogs()).toEqual([expect.objectContaining({ itemId: 'a', colorBefore: 'red', colorAfter: 'green', note: 'clean' })])
    expect(getItems('act-1').find(i => i.id === 'a')!.color).toBe('green')
    expect(screen.getByText('Saved "Box"')).toBeInTheDocument()
  })

  it('Undo removes the rep and restores the colour', () => {
    seed()
    renderScreen()
    click(/Box/)
    click('Solid')
    click('Save')
    click('Undo')
    expect(getLogs()).toEqual([])
    expect(getItems('act-1').find(i => i.id === 'a')!.color).toBe('red')
  })

  it('search narrows the list', () => {
    seed()
    renderScreen()
    fireEvent.change(screen.getByPlaceholderText('Search tricks'), { target: { value: 'mill' } })
    expect(screen.queryByRole('button', { name: /Box/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Mills Mess/ })).toBeInTheDocument()
  })

  it("shows the item's past notes when rating it", () => {
    seed()
    renderScreen()
    click(/Box/)
    click('Okay')
    fireEvent.change(screen.getByPlaceholderText('Add a note (optional)'), { target: { value: 'drop on 3' } })
    click('Save')
    click(/Box/)
    expect(screen.getByText('drop on 3')).toBeInTheDocument()
  })
})
