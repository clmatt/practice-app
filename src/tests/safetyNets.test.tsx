import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

vi.mock('../db', async importOriginal => {
  const actual = await importOriginal<typeof import('../db')>()
  return { ...actual, applyOps: vi.fn(actual.applyOps) }
})

import { applyOps } from '../db'
import { saveActivity, flushWrites } from '../storage'
import ErrorBoundary from '../components/ErrorBoundary'
import StorageErrorBanner from '../components/StorageErrorBanner'

function Boom(): never {
  throw new Error('kaboom')
}

describe('ErrorBoundary', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('shows a recovery screen with export and reload instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><p>all good</p></ErrorBoundary>)
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})

describe('StorageErrorBanner', () => {
  it('is hidden until a save fails, then offers export', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<StorageErrorBanner />)
    expect(screen.queryByRole('alert')).toBeNull()

    vi.mocked(applyOps).mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'))
    await act(async () => {
      saveActivity({ id: 'a', name: 'A', itemLabel: 'x', weights: { red: 1, yellow: 0, green: 0 }, createdAt: '2026-01-01T00:00:00.000Z' })
      await flushWrites()
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/storage is full/i)
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument()
  })
})
