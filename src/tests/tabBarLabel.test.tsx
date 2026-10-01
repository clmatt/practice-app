import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TabBar from '../components/TabBar'
import { saveActivity } from '../storage'

describe('TabBar items tab', () => {
  it("is named after the activity's items", () => {
    saveActivity({ id: 'b', name: 'Climbing', itemLabel: 'route', weights: { red: 0.6, yellow: 0.3, green: 0.1 }, createdAt: '2026-01-01T00:00:00.000Z' })
    render(<MemoryRouter><TabBar activityId="b" activityName="Climbing" /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Routes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Items' })).toBeNull()
  })

  it('falls back to "Items" when the activity is unknown', () => {
    render(<MemoryRouter><TabBar activityId="missing" /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Items' })).toBeInTheDocument()
  })
})
