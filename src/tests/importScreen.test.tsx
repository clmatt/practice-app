import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../backup', async importOriginal => {
  const actual = await importOriginal<typeof import('../backup')>()
  return { ...actual, exportData: vi.fn() }
})

import ImportScreen from '../screens/ImportScreen'
import { saveActivity, saveItem, getActivities, getItems } from '../storage'

const activity = { id: 'old', name: 'Juggling', itemLabel: 'trick', weights: { red: 1, yellow: 0, green: 0 }, createdAt: '2026-01-01T00:00:00.000Z' }

function chooseFile(content: object) {
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File([JSON.stringify(content)], 'backup.json', { type: 'application/json' })] } })
}

function renderImport() {
  render(
    <MemoryRouter initialEntries={['/import']}>
      <Routes>
        <Route path="/import" element={<ImportScreen />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Import: replacing data', () => {
  it('asks before an import that removes data, then applies it', async () => {
    saveActivity(activity)
    saveItem({ id: 'i1', activityId: 'old', name: 'Box', color: 'red', createdAt: '2026-01-01T00:00:00.000Z' })
    renderImport()
    chooseFile({ activities: [{ ...activity, id: 'new' }], items: [], logs: [] })
    fireEvent.click(await screen.findByRole('button', { name: /Replace with imported/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    expect(screen.getByText(/Replaces Juggling\. Permanently removes 1 item and 0 reps/)).toBeInTheDocument()
    expect(getItems('old')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Import without backup' }))
    expect(screen.getByText('Import complete.')).toBeInTheDocument()
    expect(getActivities().map(a => a.id)).not.toContain('old')
  })

  it('Cancel leaves the data alone', async () => {
    saveActivity(activity)
    renderImport()
    chooseFile({ activities: [{ ...activity, id: 'new' }], items: [], logs: [] })
    fireEvent.click(await screen.findByRole('button', { name: /Replace with imported/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(getActivities().map(a => a.id)).toEqual(['old'])
    expect(screen.getByText('Choose file')).toBeInTheDocument()
  })

  it('imports straight away when nothing would be removed', async () => {
    renderImport()
    chooseFile({ activities: [{ ...activity, id: 'new' }], items: [], logs: [] })
    expect(await screen.findByText('Import complete.')).toBeInTheDocument()
  })
})
