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

  it('on touch, keeps the summary until you tap somewhere outside the chart', () => {
    render(<><ColorDistributionChart rows={rows} /><p>elsewhere</p></>)
    const svg = screen.getByRole('img')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 340, height: 220, right: 340, bottom: 220, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.pointerDown(svg, { clientX: 330, clientY: 100, pointerType: 'touch' })
    fireEvent.pointerLeave(svg, { pointerType: 'touch' })
    expect(screen.getByRole('status')).toHaveTextContent('Sep 11')

    fireEvent.pointerDown(svg, { clientX: 10, clientY: 100, pointerType: 'touch' })
    expect(screen.getByRole('status')).toHaveTextContent('Sep 1')

    fireEvent.pointerDown(screen.getByText('elsewhere'), { pointerType: 'touch' })
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

describe('ColorDistributionChart with a long history', () => {
  afterEach(() => { vi.restoreAllMocks() })

  // 35 consecutive days; red alternates 0/5 day to day (the kind of jitter that looked spiky).
  const longRows = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(2026, 7, 3 + i)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { date, red: i % 2 === 0 ? 0 : 5, yellow: 2, green: 10 }
  })

  it('says it is drawn week by week', () => {
    render(<ColorDistributionChart rows={longRows} />)
    expect(screen.getByText("Drawn week by week. Tap for any day's exact counts.")).toBeInTheDocument()
  })

  it("still shows a single day's exact counts on tap", () => {
    render(<ColorDistributionChart rows={longRows} />)
    const svg = screen.getByRole('img')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 340, height: 220, right: 340, bottom: 220, x: 0, y: 0, toJSON: () => ({}) })
    // Day 13 is Aug 16 (red 5); the plot runs from x 28 to 332 across the 35 days.
    const x = 28 + (13 / 34) * (340 - 28 - 8)
    fireEvent.pointerDown(svg, { clientX: x, clientY: 100, pointerType: 'touch' })
    const tooltip = screen.getByRole('status')
    expect(tooltip).toHaveTextContent('Aug 16')
    expect(tooltip).toHaveTextContent('5Red')
    expect(tooltip).toHaveTextContent('2Yellow')
    expect(tooltip).toHaveTextContent('10Green')
  })

  it('short histories have no weekly note', () => {
    render(<ColorDistributionChart rows={longRows.slice(0, 20)} />)
    expect(screen.queryByText(/Drawn week by week/)).toBeNull()
  })
})
