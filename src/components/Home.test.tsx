import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { getTodayKey, resolveDeviceTimezone } from '../domain/date'

const {
  reportSaveError,
  createLedgerMock,
  deleteLedgerMock,
  updateLedgerColorMock,
  updateLedgerDefaultStateMock,
  updateLedgerNameMock,
  deleteAllUserDataMock,
  reauthenticateWithGoogleMock,
  reauthenticateWithPasswordMock,
  deleteAuthAccountMock,
} = vi.hoisted(() => ({
  reportSaveError: vi.fn(),
  createLedgerMock: vi.fn(),
  deleteLedgerMock: vi.fn(),
  updateLedgerColorMock: vi.fn(),
  updateLedgerDefaultStateMock: vi.fn(),
  updateLedgerNameMock: vi.fn(),
  deleteAllUserDataMock: vi.fn(),
  reauthenticateWithGoogleMock: vi.fn(),
  reauthenticateWithPasswordMock: vi.fn(),
  deleteAuthAccountMock: vi.fn(),
}))

vi.mock('./TodaySection', () => ({
  TodaySection: ({
    ledgerId,
    defaultState,
    timezone,
    accentColor,
  }: {
    ledgerId: string
    defaultState: string
    timezone: string
    accentColor?: string
  }) => (
    <div data-testid="today-section">
      today-section:{ledgerId}:{defaultState}:{timezone}:{accentColor ?? 'none'}
    </div>
  ),
}))
vi.mock('./CalendarSheet', () => ({
  CalendarSheet: ({ todayKey, onDismiss }: { todayKey: string; onDismiss: () => void }) => (
    <div data-testid="calendar-sheet">
      calendar-sheet:{todayKey}
      <button type="button" onClick={onDismiss}>
        Close calendar
      </button>
    </div>
  ),
}))
vi.mock('./SettingsSheet', () => ({
  SettingsSheet: ({
    name,
    defaultState,
    color,
    onSaveName,
    onSaveDefaultState,
    onSaveColor,
    onDelete,
    onTourNoted,
    onDismiss,
    authProviderId,
    onDeleteAccount,
  }: {
    name: string
    defaultState: string
    color: string
    onSaveName: (next: string) => Promise<void>
    onSaveDefaultState: (next: 'did' | 'didnt') => Promise<void>
    onSaveColor: (next: string) => Promise<void>
    onDelete: () => Promise<void>
    onTourNoted: () => void
    onDismiss: () => void
    authProviderId: string
    onDeleteAccount: (password?: string) => Promise<void>
  }) => (
    <div data-testid="settings-sheet">
      settings-sheet:{name}:{defaultState}:{color}:{authProviderId}
      <button type="button" onClick={() => void onSaveName('Renamed').catch(reportSaveError)}>
        Save name
      </button>
      <button type="button" onClick={() => void onSaveDefaultState('didnt').catch(reportSaveError)}>
        Save didnt
      </button>
      <button type="button" onClick={() => void onSaveColor('moss').catch(reportSaveError)}>
        Save moss
      </button>
      <button type="button" onClick={() => void onDelete().catch(reportSaveError)}>
        Delete this ledger
      </button>
      <button type="button" onClick={() => void onDeleteAccount('hunter2').catch(reportSaveError)}>
        Delete my account
      </button>
      <button type="button" onClick={onTourNoted}>
        Tour Noted.
      </button>
      <button type="button" onClick={onDismiss}>
        Close settings
      </button>
    </div>
  ),
}))
vi.mock('./LedgerSwitcherSheet', () => ({
  LedgerSwitcherSheet: ({
    ledgers,
    activeLedgerId,
    onSwitch,
    onCreate,
    onManage,
    onDismiss,
  }: {
    ledgers: { id: string; name: string }[]
    activeLedgerId: string
    onSwitch: (id: string) => void
    onCreate: (input: { name: string; defaultState: 'did' | 'didnt'; color: string }) => Promise<void>
    onManage: (id: string) => void
    onDismiss: () => void
  }) => (
    <div data-testid="ledger-switcher-sheet">
      ledger-switcher-sheet:{activeLedgerId}:{ledgers.map((l) => l.name).join(',')}
      <button type="button" onClick={() => onSwitch('ledger-2')}>
        Switch to ledger-2
      </button>
      <button
        type="button"
        onClick={() =>
          void onCreate({ name: 'Reading', defaultState: 'did', color: 'clay' }).catch(reportSaveError)
        }
      >
        Create ledger
      </button>
      <button
        type="button"
        onClick={() => {
          onManage('ledger-1')
          onDismiss()
        }}
      >
        Manage active ledger
      </button>
      <button
        type="button"
        onClick={() => {
          onManage('ledger-2')
          onDismiss()
        }}
      >
        Manage ledger-2
      </button>
      <button type="button" onClick={onDismiss}>
        Close switcher
      </button>
    </div>
  ),
}))
vi.mock('../hooks/useLocalDateKey', () => ({
  useLocalDateKey: () => '2026-08-10',
}))
vi.mock('../data/ledger', () => ({
  createLedger: (...args: unknown[]) => createLedgerMock(...args),
  deleteLedger: (...args: unknown[]) => deleteLedgerMock(...args),
  updateLedgerColor: (...args: unknown[]) => updateLedgerColorMock(...args),
  updateLedgerDefaultState: (...args: unknown[]) => updateLedgerDefaultStateMock(...args),
  updateLedgerName: (...args: unknown[]) => updateLedgerNameMock(...args),
  updateLedgerStateLabels: vi.fn(),
}))
vi.mock('../data/account', () => ({
  deleteAllUserData: (...args: unknown[]) => deleteAllUserDataMock(...args),
}))
vi.mock('../lib/auth', () => ({
  signOutUser: vi.fn(),
  reauthenticateWithGoogle: (...args: unknown[]) => reauthenticateWithGoogleMock(...args),
  reauthenticateWithPassword: (...args: unknown[]) => reauthenticateWithPasswordMock(...args),
  deleteAuthAccount: (...args: unknown[]) => deleteAuthAccountMock(...args),
}))

beforeEach(() => {
  reportSaveError.mockReset()
  createLedgerMock.mockReset().mockResolvedValue({ id: 'ledger-new', name: 'Reading', defaultState: 'did', timezone: 'UTC', startDate: '2026-08-10' })
  deleteLedgerMock.mockReset().mockResolvedValue(undefined)
  updateLedgerColorMock.mockReset().mockResolvedValue(undefined)
  updateLedgerDefaultStateMock.mockReset().mockResolvedValue(undefined)
  updateLedgerNameMock.mockReset().mockResolvedValue(undefined)
  deleteAllUserDataMock.mockReset().mockResolvedValue(undefined)
  reauthenticateWithGoogleMock.mockReset().mockResolvedValue(undefined)
  reauthenticateWithPasswordMock.mockReset().mockResolvedValue(undefined)
  deleteAuthAccountMock.mockReset().mockResolvedValue(undefined)
  window.localStorage.clear()
})

const { Home } = await import('./Home')

const ledger = {
  id: 'ledger-1',
  name: 'Worked out',
  defaultState: 'did' as const,
  timezone: 'UTC',
  startDate: '2026-08-01',
}

function renderSettledHome(overrides: Partial<Parameters<typeof Home>[0]> = {}) {
  const uid = overrides.uid ?? 'u1'
  const onSwitchLedger = vi.fn()
  render(
    <Home
      uid={uid}
      ledgers={[ledger]}
      activeLedger={ledger}
      onSwitchLedger={onSwitchLedger}
      authProviderId="password"
      {...overrides}
    />,
  )
  return { onSwitchLedger }
}

describe('Home', () => {
  it('renders the brand, date, ledger name, and today section without the calendar', () => {
    renderSettledHome()

    expect(screen.getByText('Noted.')).toBeInTheDocument()
    expect(screen.getByText('Today · 08/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Worked out')).toBeInTheDocument()
    expect(screen.getByTestId('today-section')).toHaveTextContent('today-section:ledger-1:did:UTC:var(--ledger-color-espresso)')
    expect(screen.queryByTestId('calendar-sheet')).not.toBeInTheDocument()
  })

  it('passes the active ledger\'s accent color through to TodaySection', () => {
    renderSettledHome({ activeLedger: { ...ledger, color: 'clay' } })
    expect(screen.getByTestId('today-section')).toHaveTextContent('var(--ledger-color-clay)')
  })

  it('resolves an uncolored ledger to the same espresso color for both the active toggle and Settings -- not two different colors', () => {
    // `ledger` (see below) has no explicit `color` at all, matching every
    // ledger created before color existed, including the legacy first one.
    renderSettledHome()

    expect(screen.getByTestId('today-section')).toHaveTextContent('var(--ledger-color-espresso)')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByTestId('settings-sheet')).toHaveTextContent('settings-sheet:Worked out:did:espresso')
  })

  it('opens and closes the calendar from the header control', () => {
    renderSettledHome()

    fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }))
    expect(screen.getByTestId('calendar-sheet')).toHaveTextContent('calendar-sheet:2026-08-10')

    fireEvent.click(screen.getByRole('button', { name: 'Close calendar' }))
    expect(screen.queryByTestId('calendar-sheet')).not.toBeInTheDocument()
  })

  it('opens and closes settings from the footer link, targeting the active ledger', () => {
    renderSettledHome()
    expect(screen.queryByTestId('settings-sheet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByTestId('settings-sheet')).toHaveTextContent('settings-sheet:Worked out:did:espresso')

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByTestId('settings-sheet')).not.toBeInTheDocument()
  })

  it('renames the active ledger from Settings opened via the footer link', async () => {
    renderSettledHome()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))

    await vi.waitFor(() => {
      expect(updateLedgerNameMock).toHaveBeenCalledWith('u1', 'ledger-1', 'Renamed')
    })
  })

  it('marks the real Settings control as the customization coach mark\'s anchor', () => {
    renderSettledHome()
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'data-tour-id',
      'open-settings',
    )
  })

  it('saves a new default state for the active ledger, with the current one first so existing days can be pinned', async () => {
    renderSettledHome()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save didnt' }))

    await vi.waitFor(() => {
      expect(updateLedgerDefaultStateMock).toHaveBeenCalledWith('u1', 'ledger-1', 'did', 'didnt')
    })
  })

  it('propagates a failed default-state save so the sheet can report it', async () => {
    updateLedgerDefaultStateMock.mockRejectedValue(new Error('offline'))
    renderSettledHome()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save didnt' }))

    await vi.waitFor(() => {
      expect(reportSaveError).toHaveBeenCalled()
    })
  })

  it('saves a new color for the active ledger', async () => {
    renderSettledHome()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save moss' }))

    await vi.waitFor(() => {
      expect(updateLedgerColorMock).toHaveBeenCalledWith('u1', 'ledger-1', 'moss')
    })
  })

  it('provides a sign-out control', () => {
    renderSettledHome()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('shows the maker mark with the app version', () => {
    renderSettledHome()
    expect(screen.getByText(`Made with ❤️ by Maker 428 · v${__APP_VERSION__}`)).toBeInTheDocument()
  })

  describe('ledger switcher', () => {
    it('has no separate header control -- the ledger title itself is the only trigger', () => {
      renderSettledHome()
      // Only "Open calendar" remains in the header; the old stacked-squares
      // trigger beside it is gone entirely, per the guardrail that the app
      // should show no second visible navigation control.
      expect(screen.getByRole('button', { name: 'Open calendar' })).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /switch ledger/i })).toHaveLength(1)
    })

    it('no longer shows an Edit link under the ledger title', () => {
      renderSettledHome()
      expect(screen.queryByRole('button', { name: /edit tracker name/i })).not.toBeInTheDocument()
      expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    })

    it('marks the ledger title as the switcher coach mark\'s anchor', () => {
      renderSettledHome()
      expect(screen.getByRole('button', { name: /switch ledger/i })).toHaveAttribute(
        'data-tour-id',
        'ledger-title',
      )
    })

    it('opens and closes the switcher from the ledger title, listing every ledger', () => {
      const otherLedger = { id: 'ledger-2', name: 'Drinking', defaultState: 'did' as const, timezone: 'UTC', startDate: '2026-08-01' }
      renderSettledHome({ ledgers: [ledger, otherLedger] })
      expect(screen.queryByTestId('ledger-switcher-sheet')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /switch ledger/i }))
      expect(screen.getByTestId('ledger-switcher-sheet')).toHaveTextContent(
        'ledger-switcher-sheet:ledger-1:Worked out,Drinking',
      )

      fireEvent.click(screen.getByRole('button', { name: 'Close switcher' }))
      expect(screen.queryByTestId('ledger-switcher-sheet')).not.toBeInTheDocument()
    })

    it('switching calls the onSwitchLedger callback from the parent', () => {
      const { onSwitchLedger } = renderSettledHome()

      fireEvent.click(screen.getByRole('button', { name: /switch ledger/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Switch to ledger-2' }))

      expect(onSwitchLedger).toHaveBeenCalledWith('ledger-2')
    })

    it('creates a new ledger and switches to it', async () => {
      const { onSwitchLedger } = renderSettledHome()
      const expectedTimezone = resolveDeviceTimezone()
      const expectedStartDate = getTodayKey(expectedTimezone)

      fireEvent.click(screen.getByRole('button', { name: /switch ledger/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Create ledger' }))

      await vi.waitFor(() => {
        expect(createLedgerMock).toHaveBeenCalledWith('u1', {
          name: 'Reading',
          defaultState: 'did',
          timezone: expectedTimezone,
          startDate: expectedStartDate,
          color: 'clay',
        })
        expect(onSwitchLedger).toHaveBeenCalledWith('ledger-new')
      })
    })

    describe('manage -> canonical Settings', () => {
      const otherLedger = { id: 'ledger-2', name: 'Drinking', defaultState: 'did' as const, timezone: 'UTC', startDate: '2026-08-01' }

      it('opens the exact same Settings sheet for a non-active ledger selected from the catalog', () => {
        renderSettledHome({ ledgers: [ledger, otherLedger] })

        fireEvent.click(screen.getByRole('button', { name: /switch ledger/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Manage ledger-2' }))

        expect(screen.getByTestId('settings-sheet')).toHaveTextContent('settings-sheet:Drinking:did:espresso')
        // The catalog itself closes -- there is exactly one settings surface open, not two.
        expect(screen.queryByTestId('ledger-switcher-sheet')).not.toBeInTheDocument()
      })

      it('opens Settings for the active ledger the same way when managed from the catalog', () => {
        renderSettledHome()

        fireEvent.click(screen.getByRole('button', { name: /switch ledger/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Manage active ledger' }))

        expect(screen.getByTestId('settings-sheet')).toHaveTextContent('settings-sheet:Worked out:did:espresso')
      })

      it('renames a non-active ledger through the catalog-opened Settings sheet', async () => {
        renderSettledHome({ ledgers: [ledger, otherLedger] })

        fireEvent.click(screen.getByRole('button', { name: /switch ledger/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Manage ledger-2' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save name' }))

        await vi.waitFor(() => {
          expect(updateLedgerNameMock).toHaveBeenCalledWith('u1', 'ledger-2', 'Renamed')
        })
      })

      it('recolors a non-active ledger through the catalog-opened Settings sheet', async () => {
        renderSettledHome({ ledgers: [ledger, otherLedger] })

        fireEvent.click(screen.getByRole('button', { name: /switch ledger/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Manage ledger-2' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save moss' }))

        await vi.waitFor(() => {
          expect(updateLedgerColorMock).toHaveBeenCalledWith('u1', 'ledger-2', 'moss')
        })
      })

      it('deletes a ledger from Settings, whether opened via the footer or the catalog', async () => {
        renderSettledHome({ ledgers: [ledger, otherLedger] })

        fireEvent.click(screen.getByRole('button', { name: /switch ledger/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Manage ledger-2' }))
        fireEvent.click(screen.getByRole('button', { name: 'Delete this ledger' }))

        await vi.waitFor(() => {
          expect(deleteLedgerMock).toHaveBeenCalledWith('u1', 'ledger-2')
        })
      })

      it('deletes the active ledger from Settings opened via the footer link', async () => {
        renderSettledHome()

        fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
        fireEvent.click(screen.getByRole('button', { name: 'Delete this ledger' }))

        await vi.waitFor(() => {
          expect(deleteLedgerMock).toHaveBeenCalledWith('u1', 'ledger-1')
        })
      })
    })

    describe('account deletion', () => {
      it('passes the auth provider id through to Settings', () => {
        renderSettledHome({ authProviderId: 'google.com' })

        fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

        expect(screen.getByTestId('settings-sheet')).toHaveTextContent('google.com')
      })

      it('reauthenticates with a password, then deletes all data, then deletes the Auth account, in that order', async () => {
        renderSettledHome({ authProviderId: 'password' })
        const order: string[] = []
        reauthenticateWithPasswordMock.mockImplementation(async () => {
          order.push('reauth')
        })
        deleteAllUserDataMock.mockImplementation(async () => {
          order.push('data')
        })
        deleteAuthAccountMock.mockImplementation(async () => {
          order.push('auth')
        })

        fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
        fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))

        await vi.waitFor(() => {
          expect(order).toEqual(['reauth', 'data', 'auth'])
        })
        expect(reauthenticateWithPasswordMock).toHaveBeenCalledWith('hunter2')
        expect(deleteAllUserDataMock).toHaveBeenCalledWith('u1')
        expect(reauthenticateWithGoogleMock).not.toHaveBeenCalled()
      })

      it('reauthenticates with Google, not a password, for a Google-provider account', async () => {
        renderSettledHome({ authProviderId: 'google.com' })

        fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
        fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))

        await vi.waitFor(() => {
          expect(deleteAuthAccountMock).toHaveBeenCalled()
        })
        expect(reauthenticateWithGoogleMock).toHaveBeenCalled()
        expect(reauthenticateWithPasswordMock).not.toHaveBeenCalled()
        expect(deleteAllUserDataMock).toHaveBeenCalledWith('u1')
      })

      it('does not delete Auth data when reauthentication fails, leaving Firestore data untouched', async () => {
        renderSettledHome({ authProviderId: 'password' })
        reauthenticateWithPasswordMock.mockRejectedValue({ code: 'auth/requires-recent-login' })

        fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
        fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))

        await vi.waitFor(() => {
          expect(reportSaveError).toHaveBeenCalled()
        })
        expect(deleteAllUserDataMock).not.toHaveBeenCalled()
        expect(deleteAuthAccountMock).not.toHaveBeenCalled()
      })

      it('does not delete the Auth account when Firestore data deletion fails', async () => {
        renderSettledHome({ authProviderId: 'password' })
        deleteAllUserDataMock.mockRejectedValue(new Error('offline'))

        fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
        fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))

        await vi.waitFor(() => {
          expect(reportSaveError).toHaveBeenCalled()
        })
        expect(deleteAuthAccountMock).not.toHaveBeenCalled()
      })
    })
  })

  describe('onboarding tour replay', () => {
    const WELCOME_TEXT = /not a habit tracker/i

    // The full onboarding/orientation experience now always runs pre-auth
    // (see App's OnboardingOrientation), before any account or ledger
    // exists -- Home itself never auto-starts a tour, regardless of uid or
    // any stored record. See App.test.tsx for that pre-auth coverage.
    it('never auto-starts, for any account', () => {
      render(<Home uid="u1" ledgers={[ledger]} activeLedger={ledger} onSwitchLedger={vi.fn()} authProviderId="password" />)
      expect(screen.queryByText(WELCOME_TEXT)).not.toBeInTheDocument()
    })

    it('is reachable from Settings, always starting from the welcome screen, and closes the settings sheet when it opens', () => {
      renderSettledHome()

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      fireEvent.click(screen.getByRole('button', { name: 'Tour Noted.' }))

      expect(screen.queryByTestId('settings-sheet')).not.toBeInTheDocument()
      expect(screen.getByText(WELCOME_TEXT)).toBeInTheDocument()
    })

    it('makes the main content inert while replaying, so it cannot be interacted with underneath', () => {
      const { container } = render(
        <Home uid="u1" ledgers={[ledger]} activeLedger={ledger} onSwitchLedger={vi.fn()} authProviderId="password" />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      fireEvent.click(screen.getByRole('button', { name: 'Tour Noted.' }))

      expect(container.querySelector('main')).toHaveAttribute('inert')
    })

    it('closes on Skip and leaves the main content interactive again, without writing or touching any onboarding record', () => {
      const { container } = render(
        <Home uid="u1" ledgers={[ledger]} activeLedger={ledger} onSwitchLedger={vi.fn()} authProviderId="password" />,
      )
      const storageWrites = vi.spyOn(Storage.prototype, 'setItem')

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      fireEvent.click(screen.getByRole('button', { name: 'Tour Noted.' }))
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

      expect(screen.queryByText(WELCOME_TEXT)).not.toBeInTheDocument()
      expect(container.querySelector('main')).not.toHaveAttribute('inert')
      expect(storageWrites).not.toHaveBeenCalled()

      storageWrites.mockRestore()
    })
  })
})
