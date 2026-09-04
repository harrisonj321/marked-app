import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

let mockRecords = new Map<string, { state?: 'did' | 'didnt'; note?: string; count?: number }>()
let mockError: string | null = null

vi.mock('../hooks/useRangeRecords', () => ({
  useRangeRecords: () => ({ records: mockRecords, loading: false, error: mockError }),
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
