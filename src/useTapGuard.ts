import { useRef, useState } from 'react'

/** How long rating buttons ignore taps after a new item appears. */
export const TAP_GUARD_MS = 500

/**
 * Keeps buttons disabled for a moment after new content appears, so the second
 * tap of a double-tap can't act on something the user hasn't seen yet.
 * Returns whether taps are accepted, and `rearm` to call when new content shows.
 */
export function useTapGuard(): [ready: boolean, rearm: () => void] {
  const [ready, setReady] = useState(true)
  const latest = useRef(0)
  function rearm() {
    const id = ++latest.current
    setReady(false)
    setTimeout(() => {
      // A newer item may have appeared since; only its own timer re-enables.
      if (latest.current === id) setReady(true)
    }, TAP_GUARD_MS)
  }
  return [ready, rearm]
}
