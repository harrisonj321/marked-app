import { useLayoutEffect, useState } from 'react'

function measureTourTarget(tourId: string): DOMRect | null {
  return document.querySelector(`[data-tour-id="${tourId}"]`)?.getBoundingClientRect() ?? null
}

/**
 * Instant (not smooth) on purpose: a step's target is scrolled into place
 * as part of establishing where the spotlight belongs, not as a visible
 * flourish of its own -- and an instant jump means the very next
 * `getBoundingClientRect()` call already reflects the final position,
 * with no animation frame to wait out first.
 */
function scrollTargetIntoView(element: Element): void {
  element.scrollIntoView({ block: 'center', inline: 'nearest' })
}

/**
 * Measures the real, currently-rendered element carrying the given
 * `data-tour-id`, so a coach mark can anchor to the actual control instead
 * of a recreated screenshot. Re-measures on resize/orientation/scroll;
 * returns null if no such element is mounted (e.g. today's toggle hasn't
 * finished loading yet), which callers should degrade gracefully from
 * rather than treat as an error.
 *
 * The caller keeps one overlay mounted across coach steps (so the spotlight
 * element persists and its CSS position transition can glide between
 * controls), which means tourId changes on a live hook. The measurement for
 * a new tourId is taken synchronously during that same render -- not
 * deferred to the effect -- so the spotlight never paints one frame anchored
 * to the previous step's control.
 */
export function useTourTargetRect(tourId: string): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(() => measureTourTarget(tourId))

  const [measuredTourId, setMeasuredTourId] = useState(tourId)
  if (measuredTourId !== tourId) {
    setMeasuredTourId(tourId)
    setRect(measureTourTarget(tourId))
  }

  const hasTarget = rect !== null

  useLayoutEffect(() => {
    const element = document.querySelector(`[data-tour-id="${tourId}"]`)
    if (!element) {
      // Not mounted yet -- e.g. the today toggle still resolving its first
      // load when its coach step opens. Watch for it to appear so the
      // spotlight can attach late instead of the step staying degraded;
      // the rect update flips hasTarget, re-running this effect onto the
      // normal subscription path below.
      const mutationObserver = new MutationObserver(() => {
        const mounted = document.querySelector(`[data-tour-id="${tourId}"]`)
        if (mounted) {
          mutationObserver.disconnect()
          scrollTargetIntoView(mounted)
          setRect(mounted.getBoundingClientRect())
        }
      })
      mutationObserver.observe(document.body, { childList: true, subtree: true })
      return () => mutationObserver.disconnect()
    }

    const remeasure = () => setRect(element.getBoundingClientRect())

    // A short viewport (a landscape phone, a foldable's cover screen) can
    // leave a step's real target below the fold of its own screen -- and
    // the screen underneath a modal tour is both scroll-locked (see
    // useOverlay) and `inert`, so nothing short of a script can bring it
    // back into view; a real person has no gesture left that would do it.
    // `.screen`'s own `overflow-y: auto` (index.css) is what gives this
    // something to scroll: `document.body` being locked doesn't stop a
    // descendant scroll container from moving. `block: 'center'` rather
    // than the usual `'nearest'` is deliberate here, not just "scroll it
    // into view" -- centering the target leaves roughly equal headroom on
    // whichever side CoachOverlay ends up placing the callout, which is
    // the room the callout's own viewport clamp (OnboardingTour.tsx) needs
    // to have something to clamp within. A target already fully visible is
    // a no-op either way -- and, deliberately, this reads `rect` no
    // further than that: an actual scroll fires a real `scroll` event,
    // which the capture-phase listener below already turns into a
    // `remeasure()`. Calling `remeasure()` here directly, unconditionally,
    // would reintroduce exactly the race `skippedInitialReport` below
    // exists to avoid -- a second, immediate getBoundingClientRect() that
    // can observe a sibling effect's mid-transform element instead of its
    // settled position (see that comment), except with no way to tell the
    // two cases apart the way the ResizeObserver report's *timing* does.
    scrollTargetIntoView(element)

    // ResizeObserver's spec-mandated first callback fires asynchronously
    // right after observe(), reporting the size as of whenever that
    // callback happens to run -- which is no fresher than the measurement
    // already taken above (or by the mutation-observer branch that led
    // here), and is vulnerable to a real race: a sibling effect elsewhere
    // in the tree (the staged orientation's onStageChange) can flip this
    // element's stage attribute in the same window, kicking off its CSS
    // entrance transform (see demo-arrive in index.css) right before this
    // callback fires. When that happens, this "initial" report captures
    // the element mid-transform -- offset by the animation's translateY --
    // and nothing ever re-measures afterward to correct it, since a pure
    // transform change doesn't trigger any *later* ResizeObserver callback
    // either. Skipping this one, always-redundant first report and
    // trusting only genuine subsequent resizes avoids the whole failure
    // mode without guessing at timing.
    let skippedInitialReport = false
    const resizeObserver = new ResizeObserver(() => {
      if (!skippedInitialReport) {
        skippedInitialReport = true
        return
      }
      remeasure()
    })
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
  }, [tourId, hasTarget])

  return rect
}
