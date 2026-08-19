/**
 * Shown once, at first-ledger creation, to make the breadth of what a
 * ledger can be concrete before the user has to invent one from scratch.
 * Deliberately mixed in kind (an action, an event, a condition, a choice,
 * an experience) so the list doesn't read as habit-tracker goals -- see
 * CLAUDE.md's "Visibility without virtue". A selection only seeds the
 * ledger name; it carries no other meaning or behavior.
 */
export const LEDGER_NAME_SUGGESTIONS: readonly string[] = [
  'Worked out',
  'Ate out',
  'Headache',
  'Drank alcohol',
  'Cooked dinner',
  'Good day',
]
