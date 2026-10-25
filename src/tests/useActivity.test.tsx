import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useActivity } from '../useActivity'
import { saveActivity } from '../storage'

function Probe() {
  const [activity] = useActivity()
  return <p>{activity ? activity.name : 'none'}</p>
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/activity/:activityId" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('useActivity', () => {
  it("returns the route's activity", () => {
    saveActivity({ id: 'act-1', name: 'Juggling', itemLabel: 'trick', weights: { red: 1, yellow: 0, green: 0 }, createdAt: '2026-01-01T00:00:00.000Z' })
    renderAt('/activity/act-1')
    expect(screen.getByText('Juggling')).toBeInTheDocument()
  })

  it('sends you Home when the activity does not exist', () => {
    renderAt('/activity/missing')
    expect(screen.getByText('home')).toBeInTheDocument()
  })
})
