import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'

// Every test starts with an empty database and empty localStorage.
// storage is imported lazily so that vi.mock('../db') in a test file still
// applies (modules imported statically here would load before the mock).
beforeEach(async () => {
  const { initStorage, resetStorageForTests } = await import('../storage')
  localStorage.clear()
  await resetStorageForTests()
  await initStorage()
})
