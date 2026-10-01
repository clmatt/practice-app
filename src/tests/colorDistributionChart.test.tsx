import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ColorDistributionChart from '../components/ColorDistributionChart'

const rows = [
  { date: '2026-09-01', red: 5, yellow: 3, green: 2 },
  { date: '2026-09-11', red: 1, yellow: 4, green: 5 },
]

describe('ColorDistributionChart', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('has a legend and describes the latest counts for screen readers', () => {
    render(<ColorDistributionChart rows={rows} />)
    const legend = screen.getByRole('list', { name: 'Legend' })
    expect(within(legend).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Red', 'Yellow', 'Green'])
    expect(screen.getByRole('img')).toHaveAccessibleName('Ratings over time. Latest, Sep 11: 1 red, 4 yellow, 5 green.')
  })

  it('shows a tooltip with every rating for the day nearest the pointer', () => {
    render(<ColorDistributionChart rows={rows} />)
    const svg = screen.getByRole('img')
    // jsdom has no layout: pretend the chart is drawn 1:1 at the page's left edge.
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 340, height: 220, right: 340, bottom: 220, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.pointerMove(svg, { clientX: 330, clientY: 100, pointerType: 'mouse' })
    const tooltip = screen.getByRole('status')
    expect(tooltip).toHaveTextContent('Sep 11')
    expect(tooltip).toHaveTextContent('1Red')
    expect(tooltip).toHaveTextContent('4Yellow')
    expect(tooltip).toHaveTextContent('5Green')
    fireEvent.pointerLeave(svg, { pointerType: 'mouse' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('offers the numbers as a table', () => {
    render(<ColorDistributionChart rows={rows} />)
    fireEvent.click(screen.getByText('Show as table'))
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByText('Sep 1')).toBeInTheDocument()
  })
})
