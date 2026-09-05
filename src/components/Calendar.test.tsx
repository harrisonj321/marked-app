import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

let mockRecords = new Map<string, { state?: 'did' | 'didnt'; note?: string; count?: number }>()
let mockError: string | null = null

const useRangeRecordsMock = vi.fn<
  (uid: string | null, ledgerId: string | null, startKey: string, endKey: string) => {
    records: typeof mockRecords
    loading: boolean
    error: string | null
  }
>(() => ({ records: mockRecords, loading: false, error: mockError }))
vi.mock('../hooks/useRangeRecords', () => ({
  useRangeRecords: (
    uid: string | null,
    ledgerId: string | null,
    startKey: string,
    endKey: string,
  ) => useRangeRecordsMock(uid, ledgerId, startKey, endKey),
}))

const saveDailyRecordMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../data/day', () => ({
  saveDailyRecord: (...args: unknown[]) => saveDailyRecordMock(...args),
}))

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  })
  mockRecords = new Map()
  mockError = null
  saveDailyRecordMock.mockClear()
  useRangeRecordsMock.mockClear()
})

const { Calendar } = await import('./Calendar')

const ledger = {
  id: 'ledger-1',
  name: 'Worked out',
  defaultState: 'did' as const,
  timezone: 'UTC',
  startDate: '2026-08-01',
}

describe('Calendar', () => {
  it('shows the current month heading with no navigation arrows', () => {
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    expect(screen.getByText('August 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next month' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument()
  })

  it('renders multiple preceding months already, without requiring navigation', () => {
    render(
      <Calendar
        uid="u1"
        ledger={{ ...ledger, startDate: '2025-01-01' }}
        todayKey="2026-08-15"
      />,
    )
    expect(screen.getByText('August 2026')).toBeInTheDocument()
    expect(screen.getByText('July 2026')).toBeInTheDocument()
    expect(screen.getByText('June 2026')).toBeInTheDocument()
  })

  it('does not render a month before the ledger start month, even within the initial history window', () => {
    render(<Calendar uid="u1" ledger={{ ...ledger, startDate: '2026-07-01' }} todayKey="2026-08-15" />)
    expect(screen.getByText('August 2026')).toBeInTheDocument()
    expect(screen.getByText('July 2026')).toBeInTheDocument()
    expect(screen.queryByText('June 2026')).not.toBeInTheDocument()
  })

  it('does not render any month beyond the current one', () => {
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    expect(screen.queryByText('September 2026')).not.toBeInTheDocument()
  })

  it('future days are not interactive', () => {
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    expect(
      screen.queryByRole('button', { name: /08\/20\/2026/ }),
    ).not.toBeInTheDocument()
  })

  it('days before the ledger start date are not interactive', () => {
    render(<Calendar uid="u1" ledger={{ ...ledger, startDate: '2026-08-05' }} todayKey="2026-08-15" />)
    expect(
      screen.queryByRole('button', { name: /08\/03\/2026/ }),
    ).not.toBeInTheDocument()
  })

  it('an active default-state day is labeled but not specially marked', () => {
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    const cell = screen.getByRole('button', { name: /08\/10\/2026, Did/ })
    expect(cell.className).not.toContain('calendar-cell-marked')
  })

  it('a non-default override is neutrally marked', () => {
    mockRecords = new Map([['2026-08-10', { state: 'didnt' }]])
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    const cell = screen.getByRole('button', { name: /08\/10\/2026, Didn't/ })
    expect(cell.className).toContain('calendar-cell-marked')
  })

  it("uses the ledger's configured labels in day aria-labels", () => {
    render(
      <Calendar
        uid="u1"
        ledger={{ ...ledger, stateLabels: { did: 'Took it', didnt: "Didn't take it" } }}
        todayKey="2026-08-15"
      />,
    )
    expect(screen.getByRole('button', { name: /08\/10\/2026, Took it/ })).toBeInTheDocument()
  })

  it("today's cell is identifiable independent of its state", () => {
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    expect(screen.getByRole('button', { name: /Today/ })).toHaveAttribute(
      'aria-current',
      'date',
    )
  })

  it('a day with a note shows a subtle indicator, not the note text', () => {
    mockRecords = new Map([['2026-08-10', { note: 'Hotel gym' }]])
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    expect(screen.queryByText('Hotel gym')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /has a note/ })).toBeInTheDocument()
  })

  it('a count greater than one is shown compactly', () => {
    mockRecords = new Map([['2026-08-10', { count: 3 }]])
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    expect(screen.getByText('3×')).toBeInTheDocument()
  })

  it('selecting an eligible day opens the detail surface pre-filled with its record', () => {
    mockRecords = new Map([['2026-08-10', { state: 'didnt', note: 'Sick' }]])
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    fireEvent.click(screen.getByRole('button', { name: /08\/10\/2026/ }))
    expect(screen.getByRole('radio', { name: "Didn't" })).toBeChecked()
    expect(screen.getByLabelText('Note')).toHaveValue('Sick')
  })

  it('the detail surface uses the configured labels when a day is selected', () => {
    mockRecords = new Map([['2026-08-10', { state: 'didnt' }]])
    render(
      <Calendar
        uid="u1"
        ledger={{ ...ledger, stateLabels: { did: 'Took it', didnt: "Didn't take it" } }}
        todayKey="2026-08-15"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /08\/10\/2026/ }))
    expect(screen.getByRole('radio', { name: "Didn't take it" })).toBeChecked()
  })

  it('loads more history when the top sentinel intersects, holding scroll position steady', () => {
    let observerCallback: IntersectionObserverCallback | null = null
    const observeMock = vi.fn()
    const OriginalIntersectionObserver = globalThis.IntersectionObserver

    class CapturingObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback
      }
      observe = observeMock
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = () => []
    }
    globalThis.IntersectionObserver = CapturingObserver as unknown as typeof IntersectionObserver

    try {
      render(
        <Calendar
          uid="u1"
          ledger={{ ...ledger, startDate: '2024-01-01' }}
          todayKey="2026-08-15"
        />,
      )

      // Initial history window: June, July, August.
      expect(screen.getByText('June 2026')).toBeInTheDocument()
      expect(screen.queryByText('May 2026')).not.toBeInTheDocument()
      expect(observeMock).toHaveBeenCalled()

      const scrollContainer = document.querySelector('.calendar-scroll') as HTMLDivElement
      // scrollHeight tracks rendered content, the way a real browser's would
      // once more months are added to the DOM below.
      Object.defineProperty(scrollContainer, 'scrollHeight', {
        configurable: true,
        get(this: HTMLDivElement) {
          return this.querySelectorAll('.calendar-month-section').length * 300
        },
      })
      scrollContainer.scrollTop = 50

      act(() => {
        observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {
          disconnect: vi.fn(),
        } as unknown as IntersectionObserver)
      })

      // Three more months widen into view...
      expect(screen.getByText('May 2026')).toBeInTheDocument()
      expect(screen.getByText('April 2026')).toBeInTheDocument()
      expect(screen.getByText('March 2026')).toBeInTheDocument()

      // ...and the viewport holds steady rather than jumping: scrollTop is
      // nudged by exactly the height the three new months added (3 * 300).
      expect(scrollContainer.scrollTop).toBe(50 + 3 * 300)
    } finally {
      globalThis.IntersectionObserver = OriginalIntersectionObserver
    }
  })

  it('stops widening history once the ledger start month is reached', () => {
    let observerCallback: IntersectionObserverCallback | null = null
    const OriginalIntersectionObserver = globalThis.IntersectionObserver

    class CapturingObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = () => []
    }
    globalThis.IntersectionObserver = CapturingObserver as unknown as typeof IntersectionObserver

    try {
      render(
        <Calendar
          uid="u1"
          ledger={{ ...ledger, startDate: '2026-05-01' }}
          todayKey="2026-08-15"
        />,
      )

      // Initial window (June-August) doesn't yet reach the May start month.
      expect(screen.getByText('June 2026')).toBeInTheDocument()
      expect(screen.queryByText('May 2026')).not.toBeInTheDocument()

      act(() => {
        observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {
          disconnect: vi.fn(),
        } as unknown as IntersectionObserver)
      })

      // One batch reaches (but does not overshoot past) the start month...
      expect(screen.getByText('May 2026')).toBeInTheDocument()
      expect(screen.queryByText('April 2026')).not.toBeInTheDocument()

      // ...and with no more history to load, the sentinel is gone.
      expect(document.querySelector('.calendar-history-sentinel')).not.toBeInTheDocument()
    } finally {
      globalThis.IntersectionObserver = OriginalIntersectionObserver
    }
  })

  it('rolls back through 12+ months of real history, across a year boundary, without an artificial stop', () => {
    let observerCallback: IntersectionObserverCallback | null = null
    const OriginalIntersectionObserver = globalThis.IntersectionObserver

    class CapturingObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      takeRecords = () => []
    }
    globalThis.IntersectionObserver = CapturingObserver as unknown as typeof IntersectionObserver

    function loadMore() {
      act(() => {
        observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {
          disconnect: vi.fn(),
        } as unknown as IntersectionObserver)
      })
    }

    try {
      // A ledger old enough to span more than two years of real history.
      render(
        <Calendar
          uid="u1"
          ledger={{ ...ledger, startDate: '2024-01-15' }}
          todayKey="2026-08-15"
        />,
      )

      // Initial window: June-August 2026 only.
      expect(screen.getByText('June 2026')).toBeInTheDocument()
      expect(screen.queryByText('December 2025')).not.toBeInTheDocument()

      const scrollContainer = document.querySelector('.calendar-scroll') as HTMLDivElement
      // scrollHeight tracks rendered content, the way a real browser's would
      // once more months are added to the DOM below.
      Object.defineProperty(scrollContainer, 'scrollHeight', {
        configurable: true,
        get(this: HTMLDivElement) {
          return this.querySelectorAll('.calendar-month-section').length * 300
        },
      })

      // Widen a few times -- well beyond the initial 3-month window, but
      // not yet at the ledger's actual start.
      loadMore()
      loadMore()

      expect(screen.getByText('December 2025')).toBeInTheDocument()
      expect(screen.queryByText('January 2024')).not.toBeInTheDocument()

      // The range query keeps widening to match -- never re-querying a
      // fixed/short window, and never fetching more than what's rendered.
      const callsSoFar = useRangeRecordsMock.mock.calls.length
      const [, , earliestStartKeySoFar] = useRangeRecordsMock.mock.calls[callsSoFar - 1]
      expect(earliestStartKeySoFar).toBe('2025-12-01')

      // Keep going until the actual ledger start is reached -- proving
      // there's no artificial stop well short of the real boundary, and
      // that it correctly crosses two year boundaries (2026->2025->2024)
      // along the way.
      for (let i = 0; i < 8; i++) loadMore()

      expect(screen.getByText('January 2025')).toBeInTheDocument()
      expect(screen.getByText('December 2024')).toBeInTheDocument()
      expect(screen.getByText('January 2024')).toBeInTheDocument()
      expect(screen.queryByText('December 2023')).not.toBeInTheDocument()

      // Reaching the real boundary stops loading -- no sentinel left to
      // trigger further (and no less-bounded) queries.
      expect(document.querySelector('.calendar-history-sentinel')).not.toBeInTheDocument()
      const lastCall = useRangeRecordsMock.mock.calls.at(-1)
      expect(lastCall?.[2]).toBe('2024-01-01')
      expect(lastCall?.[3]).toBe('2026-08-31')

      // Every one of those repeated loads held the scroll position steady
      // (the compensation effect ran on each, never resetting to 0).
      expect(scrollContainer.scrollTop).toBeGreaterThan(0)
    } finally {
      globalThis.IntersectionObserver = OriginalIntersectionObserver
    }
  })

  it('saving from the detail surface persists via saveDailyRecord for the selected day, scoped to the ledger', async () => {
    render(<Calendar uid="u1" ledger={ledger} todayKey="2026-08-15" />)
    fireEvent.click(screen.getByRole('button', { name: /08\/10\/2026/ }))
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Wedding' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => {
      expect(saveDailyRecordMock).toHaveBeenCalledWith('u1', 'ledger-1', '2026-08-10', {
        kind: 'set',
        note: 'Wedding',
      })
    })
  })
})
