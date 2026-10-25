import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ColorDot from '../components/ColorDot'
import ColorPicker from '../components/ColorPicker'

describe('ColorDot', () => {
  it('is named after its color, so color is not the only signal', () => {
    render(<ColorDot color="red" />)
    expect(screen.getByRole('img', { name: 'Red' })).toBeInTheDocument()
  })

  it('is hidden from screen readers when the color is already written next to it', () => {
    render(<p><ColorDot color="green" decorative /> green</p>)
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('ColorPicker', () => {
  it('reports which color is selected', () => {
    render(<ColorPicker value="green" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Solid' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Struggled' })).toHaveAttribute('aria-pressed', 'false')
  })
})
