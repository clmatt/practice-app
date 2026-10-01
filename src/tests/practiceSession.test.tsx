import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PracticeSessionScreen from '../screens/PracticeSessionScreen'
import { saveActivity, saveItem } from '../storage'
import type { Activity, Item } from '../types'

const activity = (o: Partial<Activity> = {}): Activity => ({
  id: 'act-1', name: 'Bouldering', itemLabel: 'problem',
  weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z', ...o,
})

const item = (id: string, name: string, tags: string[]): Item => ({
  id, activityId: 'act-1', name, color: 'red', tags, createdAt: '2026-01-01T00:00:00.000Z',
})

function seed(o: Partial<Activity> = {}) {
  saveActivity(activity(o))
  saveItem(item('a', 'Slab problem', ['V3', 'slab']))
  saveItem(item('b', 'Roof problem', ['V4', 'overhang']))
}

function renderSession() {
  render(
    <MemoryRouter initialEntries={['/activity/act-1/practice']}>
      <Routes>
        <Route path="/activity/:activityId/practice" element={<PracticeSessionScreen />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

function startWith(tag: string) {
  click(tag)
  click('Start with selected')
}

function rateCurrent() {
  click('I practiced it')
  click('Solid')
  click('Save')
}

describe('item screen', () => {
  it("shows the item's own tags as labels, not every tag as a filter toggle", () => {
    seed()
    renderSession()
    startWith('V3')
    expect(screen.getByText('Slab problem')).toBeInTheDocument()
    expect(screen.getByText('slab')).toBeInTheDocument()
    expect(screen.queryByText('overhang')).toBeNull()
    expect(screen.queryByRole('button', { name: 'V4' })).toBeNull()
    expect(screen.getByText(/Filter: V3/)).toBeInTheDocument()
  })

  it('"Change" on the item screen opens the filter step and redraws with the new filter', () => {
    seed()
    renderSession()
    startWith('V3')
    click('Change')
    expect(screen.getByText('Filter for next item')).toBeInTheDocument()
    click('V3')
    click('V4')
    click('Next item')
    expect(screen.getByText('Roof problem')).toBeInTheDocument()
  })
})

describe('"Choose filter before each item" setting', () => {
  it('when on, Save leads to the filter step with the current filter selected', () => {
    seed({ chooseFilterEachItem: true })
    renderSession()
    startWith('V3')
    rateCurrent()
    expect(screen.getByText('Filter for next item')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'V3' })).toHaveClass('bg-violet-600')
    click('V3')
    click('V4')
    click('Next item')
    expect(screen.getByText('Roof problem')).toBeInTheDocument()
  })

  it('when on, Skip draws another item straight away without the filter step', () => {
    seed({ chooseFilterEachItem: true })
    renderSession()
    click('Start — practice all')
    const first = screen.queryByText('Slab problem') ? 'Slab problem' : 'Roof problem'
    click('Skip without rating')
    expect(screen.queryByText('Filter for next item')).toBeNull()
    expect(screen.getByText(first === 'Slab problem' ? 'Roof problem' : 'Slab problem')).toBeInTheDocument()
  })

  it('when off, Save draws the next item directly (unchanged behaviour)', () => {
    seed()
    renderSession()
    startWith('V3')
    rateCurrent()
    expect(screen.queryByText('Filter for next item')).toBeNull()
    expect(screen.getByText('All done with your current filter.')).toBeInTheDocument()
  })
})
