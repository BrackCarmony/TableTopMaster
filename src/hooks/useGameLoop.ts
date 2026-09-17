import { useEffect, useRef } from 'react'
import { useGameStore } from '../game/store'

const TICK_INTERVAL_MS = 250

/**
 * Drives the idle simulation forward on a fixed wall-clock interval.
 * Deliberately not requestAnimationFrame: browsers fully stop calling rAF
 * callbacks the moment a tab is backgrounded, which for an idle game players
 * are expected to leave running in another tab meant the whole simulation
 * just halted — every table frozen — for as long as the tab stayed hidden,
 * with no error and no way to tell it apart from an actual bug.
 * setInterval keeps firing even when hidden (browsers throttle it to
 * roughly once per second in the background, but never fully stop it), and
 * dt is measured from Date.now() rather than assumed from the schedule, so
 * throttling just means coarser-grained progress instead of none at all.
 */
export function useGameLoop(): void {
  const lastRef = useRef(Date.now())

  useEffect(() => {
    lastRef.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const dt = now - lastRef.current
      lastRef.current = now
      useGameStore.getState().tick(dt)
    }, TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
