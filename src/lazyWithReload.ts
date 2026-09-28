// A lazily-loaded chunk can 404 after a new deploy while this tab stays open
// (its old chunk hash no longer exists). Reload once to pick up the new
// build; the sessionStorage flag stops a genuinely broken chunk from
// reloading forever, and is cleared once a load succeeds.
const RELOAD_FLAG = 'practice:stats-chunk-reload'

export function lazyWithReload<T>(load: () => Promise<T>): () => Promise<T> {
  return () => load().then(
    mod => { try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* best effort */ }; return mod },
    error => {
      let alreadyReloaded: string | null
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG)
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1')
      } catch {
        throw error
      }
      if (alreadyReloaded) throw error
      window.location.reload()
      return new Promise<T>(() => {}) // reloading; never resolves
    },
  )
}
