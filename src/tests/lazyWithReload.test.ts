import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lazyWithReload } from '../lazyWithReload'

const FLAG = 'practice:stats-chunk-reload'

describe('lazyWithReload', () => {
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sessionStorage.clear()
    reloadSpy = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reloads once on the first chunk-load failure, and the returned promise never settles', async () => {
    const load = lazyWithReload(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    let settled = false
    void load().then(() => { settled = true }, () => { settled = true })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)
    expect(sessionStorage.getItem(FLAG)).toBe('1')
  })

  it('rethrows the failure instead of reloading again within the same session', async () => {
    sessionStorage.setItem(FLAG, '1')
    const error = new Error('Failed to fetch dynamically imported module')
    const load = lazyWithReload(() => Promise.reject(error))

    await expect(load()).rejects.toBe(error)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('clears the flag once a load succeeds, so a later failure can reload again', async () => {
    sessionStorage.setItem(FLAG, '1')
    const mod = { default: () => null }
    const load = lazyWithReload(() => Promise.resolve(mod))

    await expect(load()).resolves.toBe(mod)
    expect(sessionStorage.getItem(FLAG)).toBeNull()
  })
})
