# Maker 428 Inheritance

This app inherits from the Maker 428 App Standard.

**Canonical source:** https://github.com/harrisonj321/maker-428-app-standard
**Inherited version:** v1.0.1
**Last reviewed against standard:** 2026-08-27

## SHOULD overrides (locally documented)

None currently documented.

**Icon convention note (not an override):** this app's general-purpose icons (`src/components/icons.tsx`) are inlined SVG rather than imported from the `lucide-react` package. A previous revision of this file recorded that as a SHOULD override; it wasn't one, and the entry is removed rather than carried forward. `STANDARD.md` §6's MUST is "use Lucide as the default general-purpose icon language," not "depend on the `lucide-react` npm package specifically," and `reference/audit-matrix.md`'s own canonical row names Marked.'s approach directly: "vendored as hand-copied inline SVGs (no npm dependency) matching Lucide's default style exactly" is listed alongside Noted.'s and Tacos' `lucide-react` imports as part of the same "cleanest convergence in the entire audit." The file's own header states these are Lucide's own path data, embedded directly to avoid the dependency, and spot-checking several against the current `lucide-react@1.34.0` release confirms this -- `X`, `ChevronDown`, and `Plus` are byte-for-byte identical, and `Calendar` differs by a 1px revision Lucide itself made upstream after this copy was taken. Nothing here needs revisiting unless a future icon is added that Lucide provides and this file doesn't already have inlined -- at which point the new glyph is added the same way, not a reason to switch the existing ones to a live import.

## Centrally-documented exceptions relied on (MUST exceptions, or protected-identity SHOULD exceptions)

- `STANDARD.md` §10.3 / §23.1 — Marked.'s destructive-action confirmations (deleting a ledger, deleting the account) intentionally carry no distinct danger styling anywhere — no red, no warning icon, the same quiet `.footer-link` treatment as any other secondary action — tied specifically to this app's "Visibility without virtue" identity. This is a centrally-approved MUST exception, recorded in the canonical standard at `STANDARD.md` §10.3 and §23.1, and in `brand/marked.md`. It is referenced here, not re-declared — per `STANDARD.md` §20.2, this app cannot create a new MUST exception locally.

## Outstanding compliance issues

None currently open. The one previously tracked here -- `STANDARD.md` §13's onboarding-tour focus-trap gap -- is closed; see below.

## Phase 4.1: shared-package adoption status

Adopted `@maker428/ui@0.1.1` (pinned exact) per `reference/migration-roadmap.md` §4.1:

- **Theme tokens, glow/shine/halo, elevation, safe-area raw insets** -- `src/index.css`'s duplicated `:root` declarations for these were removed in favor of `@maker428/ui/styles.css` (imported once, in `main.tsx`); the values were already byte-identical, so this was source consolidation, not a redesign. What's left locally is genuinely Marked.-specific: the paper-grain texture and the ledger color palette, plus the safe-area *composite* formulas this app builds on top of the package's raw `--safe-area-*` tokens (those composites don't match the package's own `--mobile-*-gap` shortcuts, so they stay local rather than being force-fit).
- **The one remaining direct glow bypass** named in `reference/audit-matrix.md` -- `.onboarding-dot-active`'s hand-written `box-shadow` -- now goes through the canonical `--object-glow` recipe instead.
- **`IconButton`** -- adopted at all eight icon-only controls in the app (calendar open, all four sheet close buttons, the ledger-row manage/edit button, the settings default-state swap, and the orientation demo's calendar button). The app's own icon glyphs are passed through unchanged as `children` (see the icon-convention note above for why they're inlined SVG rather than `lucide-react` imports -- both are compliant); two controls whose glyph has always rendered smaller than the primitive's 20px default (the manage icon at 16px, the swap icon at 18px) get a small unlayered CSS override preserving that exact size.
- **`MakerMark`** -- the footer attribution is now `<MakerMark version={__APP_VERSION__} />` rather than a hand-typed string carrying the same canonical wording.
- **The shared overlay-accessibility helper (`useOverlay`)** -- closes the tour focus-trap gap; see below.
- **`Sheet`** -- deliberately not adopted. This app's four native `<dialog>` sheets remain valid per `STANDARD.md` §10.1 for content this simple, exactly as the roadmap anticipated; nothing about this migration required touching them.

Also closed in this same phase, independent of the package (`STANDARD.md` §15, `patterns/pwa-and-installation.md` §2.2): the PWA manifest's missing maskable icon pair. `icon-512.png` previously carried both `purpose: 'any'` and `purpose: 'maskable'` at once -- the exact anti-pattern §2.2 names, since an `any` icon is authored trusting nothing will crop it. The manifest now declares a genuinely separate, generously-padded `icon-192-maskable.png` / `icon-512-maskable.png` pair (same mark and background, rescaled inward so it survives an arbitrary adaptive-icon crop), matching Tacos' canonical four-icon reference.

### Onboarding-tour accessibility gap: closed

The hand-rolled onboarding-tour overlay (`src/components/OnboardingTour.tsx`) wraps its rendered content in one container, portals it straight to `document.body`, and calls the shared `useOverlay` on it, providing the full contract: focus entry, full Tab/Shift+Tab trapping (the originally-named gap -- previously nothing stopped Tab from leaving the tour into the screen underneath), topmost Escape ownership (replacing a manual `window` keydown listener), scroll locking (replacing a manual `document.body.style.overflow` toggle), focus return to whatever opened the tour on close (previously absent entirely -- a genuine new correctness win, not a preserved behavior), and real background isolation (`isolateBackground` at its default `true`, unset locally).

Background isolation was initially adopted incompletely: the tour was left nested inside the app tree with `isolateBackground: false`, and `Home.tsx`/`OnboardingOrientation.tsx` hand-marked only their own `<main>` inert to compensate. That missed any *other* interactive content mounted at the React root alongside them -- concretely, `UpdatePrompt` (`main.tsx` renders it as a sibling of `<App/>`, not inside it), which stayed reachable and screen-reader-visible while the tour was open. Portalling the tour to `document.body` and using the package's own isolation (rather than a local substitute) closes this fully: isolation now applies to the whole React-root branch the package can see, not just whichever single sibling was hand-wired, so it reaches `UpdatePrompt` the same way it reaches Home/the demo shell, without either needing to know the tour exists. The previous per-screen `inert` toggle is removed as no longer needed.

`0.1.0`'s own opener-capture defect (this app was the first real consumer to hit it: a child effect could move focus before the package's registration effect ran, silently capturing the tour's own about-to-unmount element as "opener") is fixed centrally in `0.1.1` -- the capture now happens at render time, before any descendant effect can run. The local `returnFocusTo` render-time-capture workaround this app carried to compensate is removed; `useOverlay`'s own default capture is used as-is.

Verified with tests (`OnboardingTour.test.tsx`): Tab wraps last-to-first and Shift+Tab wraps first-to-last within the tour, including with reachable-looking siblings present in the DOM (jsdom doesn't enforce `inert`, so this proves the trap itself, not just the attribute); focus returns to a real external opener once the tour closes, with no local capture involved; Escape (fixed to dispatch from the actually-focused element, matching real browser event bubbling -- `fireEvent.keyDown(window, …)` never reached `document.documentElement` at all) still exits the tour as skipped, and is still ignored during the staged finale's closing beat; background isolation reaches every sibling outside the tour -- both Home's own content and a rendered stand-in for `UpdatePrompt` -- and is fully released on close.

## Notes

- Do not edit a generated/synced copy of the standard if one exists in this repository — it is not a source of truth. Edit `STANDARD.md` in the canonical repository instead, and update this file's "Inherited version" once this app has actually adopted the change.
- This file does not replace this app's own `CLAUDE.md`, which still defines what the product *is*. `CLAUDE.md` should point here first for UI/interaction/onboarding/navigation/theme/accessibility/PWA questions, and reserve its own content for product-specific behavior and exceptions.
