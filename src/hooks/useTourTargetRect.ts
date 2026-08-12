import { useLayoutEffect, useState } from 'react'

function measureTourTarget(tourId: string): DOMRect | null {
  return document.querySelector(`[data-tour-id="${tourId}"]`)?.getBoundingClientRect() ?? null
}

/**
 * Measures the real, currently-rendered element carrying the given
 * `data-tour-id`, so a coach mark can anchor to the actual control instead
 * of a recreated screenshot. Re-measures on resize/orientation/scroll;
 * returns null if no such element is mounted (e.g. today's toggle hasn't
 * finished loading yet), which callers should degrade gracefully from
 * rather than treat as an error.
 *
 * A given tourId is fixed for the life of the caller in practice (Onboarding
 * Tour mounts a fresh CoachStep per step rather than changing an existing
 * one's tourId), so the initial measurement is taken directly during render
 * via the lazy initializer; the effect exists only to subscribe to changes
 * afterward, not to duplicate that first measurement.
 */
export function useTourTargetRect(tourId: string): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(() => measureTourTarget(tourId))

  useLayoutEffect(() => {
    const element = document.querySelector(`[data-tour-id="${tourId}"]`)
    if (!element) {
      return
    }

    const remeasure = () => setRect(element.getBoundingClientRect())

    const resizeObserver = new ResizeObserver(remeasure)
    resizeObserver.observe(element)
    window.addEventListener('resize', remeasure)
    window.addEventListener('orientationchange', remeasure)
    window.addEventListener('scroll', remeasure, true)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('orientationchange', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [tourId])

  return rect
}
