import { useState } from 'react'
import {
  createLedger,
  deleteLedger,
  updateLedgerColor,
  updateLedgerDefaultState,
  updateLedgerName,
  updateLedgerStateLabels,
} from '../data/ledger'
import { hasCompletedOnboarding, saveOnboardingRecord } from '../data/onboarding'
import { signOutUser } from '../lib/auth'
import { formatDisplayDate, getTodayKey, resolveDeviceTimezone } from '../domain/date'
import type { OnboardingStatus } from '../domain/onboarding'
import type { Ledger, LedgerColor } from '../domain/ledger'
import { useLocalDateKey } from '../hooks/useLocalDateKey'
import { resolveStateLabels, type DayState, type StateLabels } from '../domain/tracker'
import { CalendarSheet } from './CalendarSheet'
import { LedgerSwitcherSheet, type NewLedgerInput } from './LedgerSwitcherSheet'
import { OnboardingTour } from './OnboardingTour'
import { SettingsSheet } from './SettingsSheet'
import { TodaySection } from './TodaySection'
import { TrackerNameEditor } from './TrackerNameEditor'
import { CalendarIcon, LayersIcon } from './icons'

interface HomeProps {
  uid: string
  ledgers: Ledger[]
  activeLedger: Ledger
  onSwitchLedger: (ledgerId: string) => void
}

export function Home({ uid, ledgers, activeLedger, onSwitchLedger }: HomeProps) {
  const todayKey = useLocalDateKey(activeLedger.timezone)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  // Gating is entirely about the persisted record, not about whether this
  // account is "new" -- every authenticated user without a completion/skip
  // record for the current onboarding version sees the tour on next open,
  // established accounts included. Lazy initializer (not an effect) so
  // there is no frame where Home is visible before the tour is active.
  const [tourActive, setTourActive] = useState(() => !hasCompletedOnboarding(uid))
  const labels = resolveStateLabels(activeLedger.stateLabels)
  const accentColor = activeLedger.color ? `var(--ledger-color-${activeLedger.color})` : undefined

  function handleTourFinish(status: OnboardingStatus) {
    saveOnboardingRecord(uid, status)
    setTourActive(false)
  }

  function handleTourNoted() {
    setSettingsOpen(false)
    setTourActive(true)
  }

  async function handleNameSave(name: string) {
    await updateLedgerName(uid, activeLedger.id, name)
  }

  async function handleDefaultStateSave(defaultState: DayState) {
    await updateLedgerDefaultState(uid, activeLedger.id, activeLedger.defaultState, defaultState)
  }

  async function handleStateLabelsSave(stateLabels: StateLabels) {
    await updateLedgerStateLabels(uid, activeLedger.id, stateLabels)
  }

  async function handleColorSave(color: LedgerColor | null) {
    await updateLedgerColor(uid, activeLedger.id, color)
  }

  async function handleCreateLedger(input: NewLedgerInput) {
    const timezone = resolveDeviceTimezone()
    const created = await createLedger(uid, {
      name: input.name,
      defaultState: input.defaultState,
      timezone,
      startDate: getTodayKey(timezone),
      color: input.color ?? undefined,
    })
    onSwitchLedger(created.id)
  }

  async function handleDeleteLedger(ledgerId: string) {
    await deleteLedger(uid, ledgerId)
  }

  return (
    <>
      <main className="screen home" inert={tourActive || undefined}>
        <header className="home-header">
          <p className="brand">Noted.</p>
          <div className="home-header-actions">
            <button
              type="button"
              className="icon-button"
              aria-label={`Switch ledger, current: ${activeLedger.name}`}
              onClick={() => setSwitcherOpen(true)}
            >
              <LayersIcon />
              {activeLedger.color && (
                <span
                  className="ledger-dot ledger-dot-header"
                  style={{ background: `var(--ledger-color-${activeLedger.color})` }}
                  aria-hidden="true"
                />
              )}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Open calendar"
              data-tour-id="open-calendar"
              onClick={() => setCalendarOpen(true)}
            >
              <CalendarIcon />
            </button>
          </div>
        </header>

        <div className="home-main">
          {todayKey && <p className="today-date">{`Today · ${formatDisplayDate(todayKey)}`}</p>}
          <TrackerNameEditor name={activeLedger.name} onSave={handleNameSave} />
          <TodaySection
            uid={uid}
            ledgerId={activeLedger.id}
            defaultState={activeLedger.defaultState}
            timezone={activeLedger.timezone}
            labels={labels}
            accentColor={accentColor}
          />
        </div>

        <footer className="home-footer">
          <div className="home-footer-links">
            <button
              type="button"
              className="footer-link"
              data-tour-id="open-settings"
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </button>
            <button type="button" className="footer-link" onClick={() => void signOutUser()}>
              Sign out
            </button>
          </div>
          <p className="maker-mark">{`Made with ❤️ by Maker 428 · v${__APP_VERSION__}`}</p>
        </footer>

        {calendarOpen && todayKey && (
          <CalendarSheet
            uid={uid}
            ledger={activeLedger}
            todayKey={todayKey}
            onDismiss={() => setCalendarOpen(false)}
          />
        )}

        {settingsOpen && (
          <SettingsSheet
            defaultState={activeLedger.defaultState}
            stateLabels={labels}
            color={activeLedger.color ?? null}
            onSaveDefaultState={handleDefaultStateSave}
            onSaveStateLabels={handleStateLabelsSave}
            onSaveColor={handleColorSave}
            onTourNoted={handleTourNoted}
            onDismiss={() => setSettingsOpen(false)}
          />
        )}

        {switcherOpen && (
          <LedgerSwitcherSheet
            ledgers={ledgers}
            activeLedgerId={activeLedger.id}
            onSwitch={onSwitchLedger}
            onCreate={handleCreateLedger}
            onDelete={handleDeleteLedger}
            onDismiss={() => setSwitcherOpen(false)}
          />
        )}
      </main>

      {tourActive && <OnboardingTour onFinish={handleTourFinish} />}
    </>
  )
}
