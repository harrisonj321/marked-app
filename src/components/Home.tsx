import { useState } from 'react'
import {
  createLedger,
  deleteLedger,
  updateLedgerColor,
  updateLedgerDefaultState,
  updateLedgerName,
  updateLedgerStateLabels,
} from '../data/ledger'
import { signOutUser } from '../lib/auth'
import { formatDisplayDate, getTodayKey, resolveDeviceTimezone } from '../domain/date'
import { resolveLedgerColor, type Ledger, type LedgerColor } from '../domain/ledger'
import { useLocalDateKey } from '../hooks/useLocalDateKey'
import { resolveStateLabels, type DayState, type StateLabels } from '../domain/tracker'
import { CalendarSheet } from './CalendarSheet'
import { LedgerSwitcherSheet, type NewLedgerInput } from './LedgerSwitcherSheet'
import { OnboardingTour } from './OnboardingTour'
import { SettingsSheet } from './SettingsSheet'
import { TodaySection } from './TodaySection'
import { CalendarIcon, ChevronDownIcon } from './icons'

interface HomeProps {
  uid: string
  ledgers: Ledger[]
  activeLedger: Ledger
  onSwitchLedger: (ledgerId: string) => void
}

export function Home({ uid, ledgers, activeLedger, onSwitchLedger }: HomeProps) {
  const todayKey = useLocalDateKey(activeLedger.timezone)
  const [calendarOpen, setCalendarOpen] = useState(false)
  // Which ledger's Settings is open, if any -- not necessarily the active
  // one. The footer's own Settings link targets the active ledger; the
  // catalog's manage affordance can target any ledger. Both routes render
  // the exact same SettingsSheet, just aimed at a different id, so there is
  // only ever one settings experience regardless of entry point.
  const [settingsLedgerId, setSettingsLedgerId] = useState<string | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  // The full onboarding/orientation tour now always runs pre-auth, before
  // any account exists (see App's OnboardingOrientation) -- Home never
  // auto-starts it. The only remaining entry point is an explicit replay
  // from Settings' "Tour Noted.", which always walks the whole experience
  // again from the welcome screen and never persists anything: replaying
  // must not corrupt the first-run record this account already has.
  const [tourActive, setTourActive] = useState(false)
  const labels = resolveStateLabels(activeLedger.stateLabels)
  const accentColor = `var(--ledger-color-${resolveLedgerColor(activeLedger.color)})`
  const settingsLedger = ledgers.find((ledger) => ledger.id === settingsLedgerId) ?? null

  function handleTourFinish() {
    setTourActive(false)
  }

  function handleTourNoted() {
    setSettingsLedgerId(null)
    setTourActive(true)
  }

  function handleManageLedger(ledgerId: string) {
    setSettingsLedgerId(ledgerId)
  }

  async function handleRenameLedger(ledgerId: string, name: string) {
    await updateLedgerName(uid, ledgerId, name)
  }

  async function handleDefaultStateSave(
    ledgerId: string,
    currentDefaultState: DayState,
    defaultState: DayState,
  ) {
    await updateLedgerDefaultState(uid, ledgerId, currentDefaultState, defaultState)
  }

  async function handleStateLabelsSave(ledgerId: string, stateLabels: StateLabels) {
    await updateLedgerStateLabels(uid, ledgerId, stateLabels)
  }

  async function handleColorSave(ledgerId: string, color: LedgerColor | null) {
    await updateLedgerColor(uid, ledgerId, color)
  }

  async function handleCreateLedger(input: NewLedgerInput) {
    const timezone = resolveDeviceTimezone()
    const created = await createLedger(uid, {
      name: input.name,
      defaultState: input.defaultState,
      timezone,
      startDate: getTodayKey(timezone),
      color: input.color,
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
          <h1 className="tracker-title">
            <button
              type="button"
              className="tracker-title-button"
              data-tour-id="ledger-title"
              aria-label={`Switch ledger, current: ${activeLedger.name}`}
              onClick={() => setSwitcherOpen(true)}
            >
              <span className="tracker-title-name">{activeLedger.name}</span>
              <ChevronDownIcon />
            </button>
          </h1>
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
              onClick={() => setSettingsLedgerId(activeLedger.id)}
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

        {settingsLedger && (
          <SettingsSheet
            name={settingsLedger.name}
            defaultState={settingsLedger.defaultState}
            stateLabels={resolveStateLabels(settingsLedger.stateLabels)}
            color={resolveLedgerColor(settingsLedger.color)}
            onSaveName={(name) => handleRenameLedger(settingsLedger.id, name)}
            onSaveDefaultState={(defaultState) =>
              handleDefaultStateSave(settingsLedger.id, settingsLedger.defaultState, defaultState)
            }
            onSaveStateLabels={(stateLabels) => handleStateLabelsSave(settingsLedger.id, stateLabels)}
            onSaveColor={(color) => handleColorSave(settingsLedger.id, color)}
            onDelete={() => handleDeleteLedger(settingsLedger.id)}
            onTourNoted={handleTourNoted}
            onDismiss={() => setSettingsLedgerId(null)}
          />
        )}

        {switcherOpen && (
          <LedgerSwitcherSheet
            ledgers={ledgers}
            activeLedgerId={activeLedger.id}
            onSwitch={onSwitchLedger}
            onCreate={handleCreateLedger}
            onManage={handleManageLedger}
            onDismiss={() => setSwitcherOpen(false)}
          />
        )}
      </main>

      {tourActive && <OnboardingTour onFinish={handleTourFinish} />}
    </>
  )
}
