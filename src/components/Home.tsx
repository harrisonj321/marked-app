import { useState } from 'react'
import { deleteAllUserData } from '../data/account'
import {
  createLedger,
  deleteLedger,
  updateLedgerColor,
  updateLedgerDefaultState,
  updateLedgerName,
  updateLedgerStateLabels,
} from '../data/ledger'
import {
  deleteAuthAccount,
  primaryProviderId,
  reauthenticateWithGoogle,
  reauthenticateWithPassword,
  signOutUser,
  type User,
} from '../lib/auth'
import { formatDisplayDate, getTodayKey, resolveDeviceTimezone } from '../domain/date'
import { resolveLedgerColor, type Ledger, type LedgerColor } from '../domain/ledger'
import { useLocalDateKey } from '../hooks/useLocalDateKey'
import { resolveStateLabels, type DayState, type StateLabels } from '../domain/tracker'
import { CalendarSheet } from './CalendarSheet'
import { LedgerSwitcherSheet, type NewLedgerInput } from './LedgerSwitcherSheet'
import { OnboardingTour } from './OnboardingTour'
import { SettingsSheet } from './SettingsSheet'
import { SignInActions } from './SignInActions'
import { TodaySection } from './TodaySection'
import { Wordmark } from './Wordmark'
import { CalendarIcon, ChevronDownIcon } from './icons'

interface HomeProps {
  /** null before/without authentication -- see the guest-state render branch below. */
  user: User | null
  /** A Google redirect that just completed and failed, surfaced from boot -- see useAuthUser. Only relevant while signed out. */
  authError?: string | null
  ledgers: Ledger[]
  activeLedger: Ledger | null
  /** True while this account's ledgers are still loading, so the zero-ledgers auto-open effect below never fires for a signed-in user whose (possibly non-empty) ledger list just hasn't arrived yet. */
  ledgersLoading: boolean
  onSwitchLedger: (ledgerId: string) => void
}

/**
 * The one continuously-mounted app shell: it renders the guest sign-in
 * state, the brief post-auth gap before ledgers resolve, the "you have no
 * ledgers yet" state, and the full experience once a ledger exists -- all
 * as the same header/main/footer shell, never swapped out for a separate
 * screen component. See App, which renders this unconditionally once
 * orientation is done, regardless of auth state.
 */
export function Home({ user, authError, ledgers, activeLedger, ledgersLoading, onSwitchLedger }: HomeProps) {
  const uid = user?.uid ?? null
  const authProviderId = user ? primaryProviderId(user) : null
  const todayKey = useLocalDateKey(activeLedger?.timezone ?? null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  // Which ledger's Settings is open, if any -- not necessarily the active
  // one. The footer's own Settings link targets the active ledger; the
  // catalog's manage affordance can target any ledger. Both routes render
  // the exact same SettingsSheet, just aimed at a different id, so there is
  // only ever one settings experience regardless of entry point.
  const [settingsLedgerId, setSettingsLedgerId] = useState<string | null>(null)

  // A signed-in account with zero ledgers has nothing to show yet -- open
  // the exact same ledger-creation sheet used to add a second (or later)
  // ledger, straight into its creation form (see LedgerSwitcherSheet's own
  // isFirstLedger handling), rather than a separate first-run page. Gated
  // on ledgersLoading so this never fires for the brief window right after
  // sign-in before an existing account's real ledger list has arrived.
  // switcherOpen's own initial value covers the common case (already
  // zero-ledgers on first render); the synchronized-during-render check
  // below (the same pattern useLedgers/useLocalDateKey already use, rather
  // than an effect, so this is never a separate cascading render) covers
  // every later transition into the same state -- e.g. ledgersLoading
  // resolving, or an existing account's last ledger being deleted. It
  // reacts only to the zero-ledgers *signal* itself changing, so a user who
  // deliberately closes the sheet back out is never immediately reopened
  // into it again while the signal stays unchanged.
  const hasNoLedgersYet = Boolean(uid) && !ledgersLoading && ledgers.length === 0
  const [switcherOpen, setSwitcherOpen] = useState(hasNoLedgersYet)
  const [trackedHasNoLedgersYet, setTrackedHasNoLedgersYet] = useState(hasNoLedgersYet)
  if (hasNoLedgersYet !== trackedHasNoLedgersYet) {
    setTrackedHasNoLedgersYet(hasNoLedgersYet)
    if (hasNoLedgersYet) {
      setSwitcherOpen(true)
    }
  }

  // The full onboarding/orientation tour now always runs pre-auth, before
  // any account exists (see App's OnboardingOrientation) -- Home never
  // auto-starts it. The only remaining entry point is an explicit replay
  // from Settings' "Tour Marked.", which always walks the whole experience
  // again from the welcome screen and never persists anything: replaying
  // must not corrupt the first-run record this account already has.
  const [tourActive, setTourActive] = useState(false)
  const settingsLedger = ledgers.find((ledger) => ledger.id === settingsLedgerId) ?? null

  function handleTourFinish() {
    setTourActive(false)
  }

  function handleTourMarked() {
    setSettingsLedgerId(null)
    setTourActive(true)
  }

  function handleManageLedger(ledgerId: string) {
    setSettingsLedgerId(ledgerId)
  }

  async function handleRenameLedger(ledgerId: string, name: string) {
    if (!uid) return
    await updateLedgerName(uid, ledgerId, name)
  }

  async function handleDefaultStateSave(
    ledgerId: string,
    currentDefaultState: DayState,
    defaultState: DayState,
  ) {
    if (!uid) return
    await updateLedgerDefaultState(uid, ledgerId, currentDefaultState, defaultState)
  }

  async function handleStateLabelsSave(ledgerId: string, stateLabels: StateLabels) {
    if (!uid) return
    await updateLedgerStateLabels(uid, ledgerId, stateLabels)
  }

  async function handleColorSave(ledgerId: string, color: LedgerColor | null) {
    if (!uid) return
    await updateLedgerColor(uid, ledgerId, color)
  }

  async function handleCreateLedger(input: NewLedgerInput) {
    if (!uid) return
    const timezone = resolveDeviceTimezone()
    const created = await createLedger(uid, {
      name: input.name,
      defaultState: input.defaultState,
      stateLabels: input.stateLabels,
      timezone,
      startDate: getTodayKey(timezone),
      color: input.color,
    })
    onSwitchLedger(created.id)
  }

  async function handleDeleteLedger(ledgerId: string) {
    if (!uid) return
    await deleteLedger(uid, ledgerId)
  }

  /**
   * Reauthenticates first, then deletes every piece of Firestore data this
   * account owns, then deletes the Auth identity itself -- in that order,
   * deliberately: reauthenticating before any destructive Firestore write
   * means a cancelled/failed reauth leaves nothing touched, and deleting
   * data before the Auth user means the client is still signed in (and so
   * still passes Firestore's isOwner check) for every one of those deletes.
   * See data/account.ts's deleteAllUserData and lib/auth.ts's
   * deleteAuthAccount. On success the Auth SDK signs the user out on its
   * own; App reacts to that and this same Home instance re-renders straight
   * into its guest state, so there is nothing further to do here.
   */
  async function handleDeleteAccount(password?: string) {
    if (!uid || !authProviderId) return
    if (authProviderId === 'password') {
      await reauthenticateWithPassword(password ?? '')
    } else {
      await reauthenticateWithGoogle()
    }
    await deleteAllUserData(uid)
    await deleteAuthAccount()
  }

  return (
    <>
      <main className="screen home home-enter" inert={tourActive || undefined}>
        <header className="home-header">
          <Wordmark className="brand" />
          {activeLedger && todayKey && (
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
          )}
        </header>

        <div className="home-main">
          {!user ? (
            <>
              <h1>Sign in to create and mark your first thing.</h1>
              <SignInActions authError={authError ?? null} />
            </>
          ) : activeLedger ? (
            <>
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
                uid={user.uid}
                ledgerId={activeLedger.id}
                defaultState={activeLedger.defaultState}
                timezone={activeLedger.timezone}
                labels={resolveStateLabels(activeLedger.stateLabels)}
                accentColor={`var(--ledger-color-${resolveLedgerColor(activeLedger.color)})`}
              />
            </>
          ) : (
            hasNoLedgersYet &&
            !switcherOpen && (
              // Defensive fallback only -- the normal first-run path is the
              // auto-opened LedgerSwitcherSheet (see hasNoLedgersYet above),
              // which for a first ledger cannot be dismissed without
              // creating one. This exists so Home can never render as an
              // empty beige screen if that sheet is ever closed some other
              // way; Sign out stays reachable from the footer regardless.
              <>
                <h1>Nothing marked yet.</h1>
                <button type="button" onClick={() => setSwitcherOpen(true)}>
                  Create your first ledger
                </button>
              </>
            )
          )}
        </div>

        <footer className="home-footer">
          <div className="home-footer-links">
            {activeLedger && (
              <button
                type="button"
                className="footer-link"
                data-tour-id="open-settings"
                onClick={() => setSettingsLedgerId(activeLedger.id)}
              >
                Settings
              </button>
            )}
            {user && (
              <button type="button" className="footer-link" onClick={() => void signOutUser()}>
                Sign out
              </button>
            )}
          </div>
          <p className="maker-mark">{`Made with ❤️ by Maker 428 · v${__APP_VERSION__}`}</p>
        </footer>

        {calendarOpen && todayKey && activeLedger && user && (
          <CalendarSheet
            uid={user.uid}
            ledger={activeLedger}
            todayKey={todayKey}
            onDismiss={() => setCalendarOpen(false)}
          />
        )}

        {settingsLedger && user && authProviderId && (
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
            onTourMarked={handleTourMarked}
            onDismiss={() => setSettingsLedgerId(null)}
            authProviderId={authProviderId}
            onDeleteAccount={handleDeleteAccount}
          />
        )}

        {switcherOpen && user && (
          <LedgerSwitcherSheet
            ledgers={ledgers}
            activeLedgerId={activeLedger?.id ?? null}
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
