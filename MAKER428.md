# Maker 428 Inheritance

This app inherits from the Maker 428 App Standard.

**Canonical source:** https://github.com/harrisonj321/maker-428-app-standard
**Inherited version:** v1.0.0
**Last reviewed against standard:** 2026-08-27

## SHOULD overrides (locally documented)

None currently documented.

## Centrally-documented exceptions relied on (MUST exceptions, or protected-identity SHOULD exceptions)

- `STANDARD.md` §10.3 / §23.1 — Marked.'s destructive-action confirmations (deleting a ledger, deleting the account) intentionally carry no distinct danger styling anywhere — no red, no warning icon, the same quiet `.footer-link` treatment as any other secondary action — tied specifically to this app's "Visibility without virtue" identity. This is a centrally-approved MUST exception, recorded in the canonical standard at `STANDARD.md` §10.3 and §23.1, and in `brand/marked.md`. It is referenced here, not re-declared — per `STANDARD.md` §20.2, this app cannot create a new MUST exception locally.

## Outstanding compliance issues

- `STANDARD.md` §13 (accessibility) — the hand-rolled onboarding-tour overlay does not implement a full Tab-cycle focus trap. The app's four native `<dialog>` sheets get focus-trapping for free from the platform; the tour overlay, built separately to support its spotlight-cutout visual, does not yet have an equivalent hand-built trap. Tracked in `reference/audit-matrix.md` row 29 and `reference/migration-roadmap.md` Phase 4 (§4.1) in the canonical standard repository. Remediation: adopt the shared overlay-accessibility helper once it's built (Phase 3), or add an equivalent hand-built focus trap in the meantime. This is tracked as an open gap, not a settled design decision.

## Notes

- Do not edit a generated/synced copy of the standard if one exists in this repository — it is not a source of truth. Edit `STANDARD.md` in the canonical repository instead, and update this file's "Inherited version" once this app has actually adopted the change.
- This file does not replace this app's own `CLAUDE.md`, which still defines what the product *is*. `CLAUDE.md` should point here first for UI/interaction/onboarding/navigation/theme/accessibility/PWA questions, and reserve its own content for product-specific behavior and exceptions.
