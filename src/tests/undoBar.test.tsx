import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import UndoBar from '../components/UndoBar'

describe('UndoBar', () => {
  afterEach(() => { vi.useRealTimers() })

  it('shows the message and calls onUndo when tapped', () => {
    const onUndo = vi.fn()
    render(<UndoBar message='Saved "Box"' onUndo={onUndo} onExpire={() => {}} />)
    expect(screen.getByText('Saved "Box"')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('expires after 6 seconds', () => {
    vi.useFakeTimers()
    const onExpire = vi.fn()
    render(<UndoBar message="Saved" onUndo={() => {}} onExpire={onExpire} />)
    act(() => { vi.advanceTimersByTime(5999) })
    expect(onExpire).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})
