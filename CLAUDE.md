# Marked.

## Maker 428 Inheritance

This app is part of the Maker 428 family and inherits the [Maker 428 App Standard v1.0.1](https://github.com/harrisonj321/maker-428-app-standard).

1. Read this file (`CLAUDE.md`) for product identity, architecture, and product-specific behavior.
2. Read the canonical [Maker 428 App Standard](https://github.com/harrisonj321/maker-428-app-standard) for shared UI, visual language, interaction, onboarding, navigation, accessibility, iconography, motion, PWA, and provenance rules.
3. Read the local [`MAKER428.md`](./MAKER428.md) for this app's inherited version, documented SHOULD overrides, centrally-approved exceptions, and outstanding compliance issues.
4. When documents conflict, follow the governance hierarchy established by the Maker 428 App Standard rather than silently choosing an implementation.

---

## Product Identity

The product name is **Marked.**

The period is intentional and is part of the name. Always write the user-facing product name exactly as `Marked.` unless a technical identifier cannot contain punctuation.

Marked. is a private personal observation log.

Its governing principle is:

> **Visibility without virtue.**

The app records what happened. It does not decide whether what happened was good, bad, healthy, unhealthy, productive, unproductive, successful, unsuccessful, desirable, or undesirable.

Marked. observes. It does not react.

This principle is a product requirement, not merely a copywriting preference.

---

## Product Philosophy

Marked. exists to make patterns visible without trying to change them.

Examples of valid things a person might track include:

- working out
- drinking alcohol
- ordering takeout
- reading
- masturbating
- calling someone
- taking a medication
- using social media
- going outside
- virtually any other recurring behavior or event

The application must not infer the user's intention from what they track.

A user tracking `Worked out` may want to do it more, less, or simply understand the pattern.

A user tracking `Had a drink` may want to do it more, less, or simply understand the pattern.

The software must treat these identically.

Do not introduce ideology around starting habits, quitting habits, abstinence, productivity, self-improvement, wellness, discipline, accountability, or behavior change.

---

## Core Mental Model

Marked. is inspired by marking events on a simple pocket calendar.

A day can carry meaning without requiring a formal entry.

The basic daily state is binary:

- it happened
- it did not happen

Neither state is inherently positive or negative.

During setup, the user chooses what an untouched day means.

Conceptually:

### Mode A

An untouched day means:

`It didn't happen.`

The user makes a mark when it did happen.

### Mode B

An untouched day means:

`It happened.`

The user makes a mark when it did not happen.

The UI may use clearer natural-language wording, but it must never frame either choice as success/failure, good/bad, compliance/noncompliance, goal completion, relapse, achievement, or similar value-laden concepts.

The app should feel like marking a paper calendar, not completing a habit tracker.

---

## Single-Ledger Experience

Marked. may contain many ledgers, but the user experiences only one ledger at a time. Multi-ledger functionality must never turn the primary experience into a dashboard, checklist, or collection of simultaneous actions.

This constraint applies to all ledger configuration below and to any future multi-ledger work; see Ledger Configuration below.

---

## Ledger Configuration

Multiple independent ledgers per user are supported. Do not turn this into a dashboard, checklist, or collection of simultaneous actions -- see Single-Ledger Experience above.

A ledger contains:

- an editable name
- a default daily state selected during setup
- the user's local timezone
- a local ledger start date
- creation/update timestamps as needed

A ledger's name and default daily state both remain editable.

Changing a ledger's default daily state must not rewrite what an already-recorded day says. Days that have a stored document keep the state they currently show; days with no document follow the new default.

Days before a ledger's start date do not have a state and must not be interpreted retroactively.

---

## Daily Logging

The primary interaction must be extremely fast.

The intended flow is:

1. Open Marked.
2. See today's state.
3. Tap one obvious primary control to flip today's state.
4. Leave.

Do not require a form or confirmation dialog for the normal daily toggle.

Tapping again must allow the user to reverse an accidental toggle.

The application should make the current state clear without implying that one state is preferable.

Avoid semantic success/failure UI such as:

- green = success
- red = failure
- celebratory checkmarks
- warning icons
- sad/happy faces
- congratulations
- shame language

Color may distinguish states, but meaning must never depend on color alone and neither state should visually read as the “winning” state.

---

## Historical Editing

Users must be able to correct past entries.

Selecting an eligible historical calendar day should allow the user to change that day's state.

Historical editing is a correction mechanism, not a journaling workflow.

Do not add audit history, explanations, approval steps, or confirmation friction unless technically necessary to prevent destructive data loss.

Future days must not be editable.

Days before the tracker start date must not be editable.

---

## Optional Detail

A daily entry may contain optional context.

V1 supports:

- a short free-text note
- an optional occurrence count

These features must remain secondary to the binary log.

The normal daily logging flow must never require either one.

### Notes

Use subtle language such as:

`Add note`

A note exists only to preserve context the user may want later.

Examples:

- `Wedding`
- `Sick`
- `Worked late`
- `Hotel gym`
- `With friends`

Do not prompt users to explain themselves.

Do not ask reflective questions.

Do not analyze note content.

Do not generate advice from notes.

Do not turn notes into a journal.

### Count

The user may optionally record that something occurred multiple times, such as:

`2×`
`3×`

A count is descriptive only.

Do not create goals, limits, averages, warnings, praise, thresholds, or recommendations from the count.

If no count is supplied for an occurrence, the UI may treat the occurrence as one for display purposes without requiring an explicit `1`.

### Structured Categories

Do **not** implement categories, tags, subtypes, or custom labels in V1.

The architecture also does not need speculative abstractions for them.

If a future product decision adds structured detail, implement it then.

---

## Calendar

The calendar is the primary history view.

Its job is to let the user see the pattern quickly.

It should visually distinguish:

- the default state
- the non-default state
- days containing a note
- days with a count greater than one
- today
- days outside the tracker lifespan

The design should remain quiet and neutral.

Untouched/default days should not look like a wall of completed or failed tasks.

A day that contains a note may use a subtle visual indicator.

Counts greater than one may be visible where practical without making the calendar noisy.

The calendar must work well on a phone-sized viewport first.

Do not add charts, streak counters, goal rings, heat maps, leaderboards, progress bars, achievement badges, or motivational summaries in V1.

---

## Explicitly Prohibited Product Behavior

Unless the user explicitly changes the product specification, do not add:

- streaks
- goals
- targets
- reminders
- notifications
- coaching
- recommendations
- encouragement
- congratulations
- failure language
- relapse language
- warnings based on behavior
- progress scores
- health judgments
- productivity judgments
- achievements
- badges
- gamification
- community features
- followers
- friends
- feeds
- comments
- sharing
- public profiles
- comparisons with other users
- social login providers other than Google
- AI analysis
- behavioral interpretation
- automatic summaries that characterize behavior as good or bad
- speculative features added “for later”

Do not add a feature merely because similar habit-tracking products have it.

Marked. is intentionally not a habit tracker.

---

## Product Voice

Copy should be short, calm, literal, and neutral.

The application should acknowledge user actions without emotionally reacting to them.

Good examples:

- `Marked.`
- `Did`
- `Didn't`
- `Add note`
- `Edit`
- `Today`
- `Save`
- `Remove note`

Avoid copy such as:

- `Great job!`
- `Keep it going!`
- `You missed today`
- `Stay on track`
- `You're crushing it`
- `Start a new streak`
- `You can do better tomorrow`
- `Goal completed`
- `Success`
- `Failure`

When uncertain, say less.

---

## Technical Stack

Use:

- React
- Vite
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Vercel (primary production frontend hosting)
- Firebase Hosting (secondary mirror; not the normal deploy target -- see Deployment Safety)
- Progressive Web App support

The application is mobile-first but must remain responsive on desktop.

Firebase is the backend platform (Authentication, Firestore, Firestore Rules). Vercel is the primary public production frontend and deploys automatically from `main` via its existing GitHub integration -- see Deployment Safety for the full release workflow.

Do not introduce another backend, database, state-management framework, UI framework, or cloud provider without a demonstrated requirement.

Prefer native React capabilities and small focused dependencies.

Keep the dependency surface minimal.

---

## Firebase Project

The dedicated Marked Firebase project is `marked-app-733c0`.

Current Firebase setup:

- Firebase Web app registered
- Cloud Firestore Standard edition created
- Firestore location: `us-west1` (Oregon)
- Firestore initialized in production mode
- Google Authentication enabled
- Email/Password Authentication enabled
- Phone Authentication disabled
- Firebase project is on the Spark/no-cost plan
- Firebase Storage is not required for Marked. and must not be used
- Google Analytics is not required for V1 and must not be added

Both Google and Email/Password Authentication are enabled on this project; see Authentication below for why both providers are required.

The app must remain compatible with the Firebase Spark plan unless the user explicitly authorizes functionality requiring billing.

Do not enable, add, or depend upon a billable Firebase/Google Cloud feature without explicit user approval.

---

## Authentication

V1 authentication supports both Google Sign-In and email/password sign-in. Both are implemented and both must remain supported.

Do not implement:

- phone authentication
- anonymous authentication
- Apple authentication
- Facebook authentication
- account linking

Authentication exists to give each user a private synchronized log across devices.

Keep auth UI minimal.

Do not build profiles or social identity features from Google account information.

Store only user information actually required by the application.

---

## Firestore Security

Security Rules are mandatory.

Never deploy or recommend deployment with permissive test rules.

All user-owned tracker configuration and entries must be scoped to the authenticated user's UID.

A user must never be able to read, list, create, update, or delete another user's private tracker data.

Rules must validate the permitted document shape and prevent clients from writing arbitrary privileged fields.

Security must not rely on UI restrictions.

Security must not rely on the Firebase web configuration being secret.

Where practical, write automated Firestore Rules tests using the Firebase Emulator Suite.

---

## Data Model Principles

Keep the model simple and explicit.

Do not create speculative schemas for future features.

Prefer storing daily documents only when needed.

An untouched day can be derived from the tracker default and does not require a Firestore document.

A daily document is needed when at least one of these is true:

- the day's state differs from the tracker default
- the day contains a note
- the day contains an explicit count or other currently supported per-day metadata

Deleting the last piece of explicit information from a day should allow the document to be removed if the day fully resolves to the tracker default.

This preserves the paper-calendar mental model and avoids generating meaningless documents for every day.

---

## Date and Time Semantics

Calendar correctness is critical.

A user's day is based on their local calendar date, not UTC.

For internal daily identity and Firestore document keys, use:

`YYYY-MM-DD`

Example:

`2026-08-10`

This internal format is not user-facing.

Whenever dates are displayed to the user, use:

`MM/DD/YYYY`

Example:

`08/10/2026`

Do not use a UTC timestamp alone to decide which calendar day an entry belongs to.

A user logging at 11:55 PM local time must not accidentally create tomorrow's entry because UTC has already crossed midnight.

Store timestamps for auditing/synchronization where useful, but daily identity must use the internal local date key.

Persist the tracker's timezone using an IANA timezone identifier where available.

Handle daylight-saving transitions correctly by relying on timezone-aware platform/library behavior rather than fixed UTC offsets.

---

## Offline and PWA Behavior

Marked. should behave like a lightweight installed phone app.

Configure it as an installable PWA.

Use an application manifest and appropriate icons when assets become available.

Prefer graceful offline behavior where supported by Firebase and the browser.

Do not create a custom offline synchronization engine unless a demonstrated problem requires one.

The primary daily interaction should remain usable under normal intermittent mobile connectivity, with clear handling of pending/error states.

Do not claim an entry is safely synchronized when a write has actually failed.

---

## Accessibility

The app must remain usable without relying solely on visual color differences.

Provide:

- semantic controls
- keyboard accessibility
- visible focus states
- adequate touch targets
- appropriate labels
- accessible contrast
- screen-reader-readable state descriptions

Do not sacrifice accessibility for minimalism.

---

## Privacy

Treat tracker names, notes, counts, and daily history as private personal data.

Do not log sensitive user-entered content to console output, analytics, crash reporting, or third-party services.

Do not expose private Firestore data publicly.

Do not add advertising or tracking SDKs.

Do not add analytics in V1 unless explicitly requested.

---

## Code Quality

Favor:

- small focused components
- explicit domain types
- pure functions for date/state resolution
- predictable data flow
- readable names
- minimal abstraction
- strong TypeScript typing

Avoid:

- giant components
- premature generalization
- unnecessary factories
- abstract frameworks around hypothetical future features
- cleverness that makes the tiny product harder to understand

The codebase should stay proportionate to the product.

---

## Testing

Behavior that can silently corrupt the log deserves tests.

At minimum, cover:

- tracker default-state resolution
- explicit state overrides
- returning an override to the default state
- note-only daily records
- count behavior
- local date-key generation
- timezone/day-boundary behavior
- tracker start-date boundaries
- prohibition on future-day editing
- historical correction
- authentication-gated data access
- Firestore Rules preventing cross-user access

Use the smallest practical test stack.

Preferred tools are:

- Vitest
- React Testing Library where component testing is useful
- Firebase Emulator Suite for Security Rules tests
- Playwright only for a small number of high-value end-to-end smoke tests if needed

Do not build an enormous test harness for trivial presentation code.

---

## Development Workflow

Before editing:

1. Read this `CLAUDE.md` completely.
2. Inspect the relevant repository files.
3. State which files you plan to create, modify, or delete.
4. Explain any destructive action before performing it.
5. Keep the requested scope tight.

While editing:

- implement the complete requested change
- do not leave placeholders such as `TODO: implement later`
- do not omit required sections
- do not silently broaden scope
- do not refactor unrelated working code unless necessary
- do not introduce dependencies without a concrete reason
- preserve existing behavior unless the request changes it

After editing:

- run the relevant tests
- run type checking
- run linting if configured
- run the production build
- report exact validation results
- identify anything that could not be validated

Never claim success if validation failed.

---

## Deployment Safety

### Production Deployment Architecture

- The primary public production frontend is **Vercel**, project `marked-app`, served at `https://marked-ledger.vercel.app`.
- Production deploys happen automatically when commits are pushed to `main`, through the existing Vercel GitHub integration. Pushing `main` *is* the deploy -- do not run a manual Vercel deploy as part of a routine release.
- Firebase remains the backend platform: Authentication, Cloud Firestore, and Firestore Rules.
- Firebase Hosting currently holds a working mirror of the frontend but is **not** the normal production deployment target. Do not run `firebase deploy --only hosting` (or a full `firebase deploy`) as part of a routine release unless the user explicitly requests it.

### Normal Frontend Release Workflow

1. Complete and verify the approved code changes.
2. Bump the version and commit as appropriate.
3. Push `main`.
4. Let the existing Vercel GitHub integration auto-deploy -- do not trigger a manual deploy.
5. Verify `https://marked-ledger.vercel.app` is serving the expected commit/version/build (compare the deployed commit SHA and/or built asset hash, not just that the site loads).
6. Do not deploy to Firebase Hosting as part of this workflow.
7. If `firestore.rules` changed, deploy the rules separately through Firebase and verify that deployment too.

### General Rules

Do not publish Firestore Rules unless the user explicitly instructs you to do so as part of a deployment/setup task.

Never weaken security rules merely to get a feature working.

Never enable billing or switch Firebase plans.

Never create Cloud Functions, Cloud Run services, Storage buckets, paid APIs, or other potentially billable infrastructure without explicit approval.

Never disconnect, delete, or reconfigure the Vercel project or Firebase Hosting without explicit approval.

---

## Git Safety

Do not force-push.

Do not rewrite existing history.

Do not delete branches or remote resources unless explicitly instructed.

Do not commit secrets.

Use `.gitignore` appropriately when the application is scaffolded.

Before committing or pushing, show the relevant `git status` and validation state.

Do not make commits or push unless the user's instruction permits it.

---

## Scope Discipline

The absence of features is part of Marked.'s design.

Do not “improve” the app by making it more like competing trackers.

When faced with two implementations, prefer the one that:

1. preserves neutrality
2. requires less user effort
3. keeps the interface quieter
4. stores only what is necessary
5. introduces less architecture
6. is easier to remove or change later

If a requested feature conflicts with **Visibility without virtue**, surface the conflict before implementing it.

---

## Decision Hierarchy

When making implementation decisions, use this priority order:

1. Explicit current user instruction
2. This `CLAUDE.md`
3. Existing verified product behavior
4. Simplicity
5. Conventional implementation practice

Do not override a product requirement because another app or common design convention works differently.

---

## Current Phase

The repository is at initial project setup.

No application code should be assumed to exist yet.

The next phase after this document is approved will be deliberate application scaffolding and foundational implementation.

Do not begin that phase unless explicitly instructed.
