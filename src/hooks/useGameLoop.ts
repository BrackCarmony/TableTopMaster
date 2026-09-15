import { useEffect } from 'react'
import { useGameStore } from '../game/store'

/** Drives the idle simulation forward via requestAnimationFrame, decoupled from React's render rate. */
export function useGameLoop(): void {
  useEffect(() => {
    let frameId: number
    let last = performance.now()

    function loop(now: number) {
      const dt = now - last
      last = now
      useGameStore.getState().tick(dt)
      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [])
}
