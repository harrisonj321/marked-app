import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTourTargetRect } from './useTourTargetRect'

/**
 * The real ResizeObserver always fires its callback once, synchronously
 * or asynchronously, immediately after observe() -- reporting whatever
 * size is current *then*, which may not be the moment the caller expects.
 * jsdom has no ResizeObserver at all (see src/test/setup.ts's stub, which
 * never calls back), so exercising the hook's handling of that mandatory
 * first report needs a fake that actually fires it -- synchronously, to
 * keep the test deterministic rather than racing real timers/microtasks.
 */
class FakeResizeObserver {
  /** Every instance registers itself here so a test can reach the one the hook constructed, without subclassing just to capture `this`. */
  static instances: FakeResizeObserver[] = []

  callback: ResizeObserverCallback
  observed: Element | null = null

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }

  observe(target: Element) {
    this.observed = target
    this.fire()
  }

  unobserve() {
    this.observed = null
  }

  disconnect() {
    this.observed = null
  }

  /** Simulates a real, later resize -- as opposed to the initial report observe() itself triggers. */
  fire() {
    if (this.observed) {
      this.callback([{ target: this.observed } as ResizeObserverEntry], this as unknown as ResizeObserver)
    }
  }
}

function mockRectSequence(tourId: string, rects: DOMRect[]) {
  let call = 0
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.getAttribute('data-tour-id') !== tourId) {
      return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => {} } as DOMRect
    }
    const rect = rects[Math.min(call, rects.length - 1)]
    call += 1
    return rect
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useTourTargetRect', () => {
  it("ignores ResizeObserver's mandatory first report instead of letting it overwrite a correct measurement with a stale one", () => {
    const originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver

    const target = document.createElement('div')
    target.setAttribute('data-tour-id', 'today-toggle')
    document.body.appendChild(target)

    // The first call is the hook's own correct, synchronous measurement.
    // Any call after that simulates the element having moved in the
    // interim (e.g. a sibling effect starting a CSS entrance transform)
    // by the time some *other* trigger re-measures it.
    const correct = { top: 100, left: 0, width: 20, height: 20, bottom: 120, right: 20, x: 0, y: 100, toJSON: () => {} } as DOMRect
    const staleIfActedOn = { top: 110, left: 0, width: 20, height: 20, bottom: 130, right: 20, x: 0, y: 110, toJSON: () => {} } as DOMRect
    mockRectSequence('today-toggle', [correct, staleIfActedOn])

    const { result } = renderHook(() => useTourTargetRect('today-toggle'))

    // ResizeObserver.observe() fired its mandatory initial report as part
    // of mounting -- if the hook acted on it, `rect` would now be
    // `staleIfActedOn` (the second queued value). It must still be the
    // first, correct measurement.
    expect(result.current?.top).toBe(100)

    globalThis.ResizeObserver = originalResizeObserver
    target.remove()
  })

  it('still re-measures on a genuine later resize, so only the redundant initial report is ignored', () => {
    const originalResizeObserver = globalThis.ResizeObserver
    FakeResizeObserver.instances = []
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver

    const target = document.createElement('div')
    target.setAttribute('data-tour-id', 'today-toggle')
    document.body.appendChild(target)

    const first = { top: 100, left: 0, width: 20, height: 20, bottom: 120, right: 20, x: 0, y: 100, toJSON: () => {} } as DOMRect
    const resized = { top: 100, left: 0, width: 40, height: 40, bottom: 140, right: 40, x: 0, y: 100, toJSON: () => {} } as DOMRect
    // Only two entries: the lazy initializer's synchronous measurement
    // consumes the first, and the mandatory-but-skipped ResizeObserver
    // report never calls getBoundingClientRect at all -- only a genuine
    // *second* fire() (below) consumes the second.
    mockRectSequence('today-toggle', [first, resized])

    const { result } = renderHook(() => useTourTargetRect('today-toggle'))
    expect(result.current?.width).toBe(20)

    // A real resize after the mandatory initial report -- this one must
    // still be honored.
    act(() => {
      FakeResizeObserver.instances.at(-1)?.fire()
    })
    expect(result.current?.width).toBe(40)

    globalThis.ResizeObserver = originalResizeObserver
    target.remove()
  })
})
