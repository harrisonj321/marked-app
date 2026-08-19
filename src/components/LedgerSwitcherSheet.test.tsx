import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LedgerSwitcherSheet, type NewLedgerInput } from './LedgerSwitcherSheet'
import type { Ledger } from '../domain/ledger'

const LEDGERS: Ledger[] = [
  { id: 'a', name: 'Worked out', defaultState: 'did', timezone: 'UTC', startDate: '2026-01-01', color: 'clay' },
  { id: 'b', name: 'Drinking', defaultState: 'didnt', timezone: 'UTC', startDate: '2026-01-01' },
  {
    id: 'c',
    name: 'Booze',
    defaultState: 'did',
    timezone: 'UTC',
    startDate: '2026-01-01',
    color: 'espresso',
  },
]

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  })
})

function renderSheet(overrides: Partial<Parameters<typeof LedgerSwitcherSheet>[0]> = {}) {
  const onSwitch = vi.fn()
  const onCreate = vi.fn<(input: NewLedgerInput) => Promise<void>>().mockResolvedValue(undefined)
  const onManage = vi.fn()
  const onDismiss = vi.fn()
  render(
    <LedgerSwitcherSheet
      ledgers={LEDGERS}
      activeLedgerId="a"
      onSwitch={onSwitch}
      onCreate={onCreate}
      onManage={onManage}
      onDismiss={onDismiss}
      {...overrides}
    />,
  )
  return { onSwitch, onCreate, onManage, onDismiss }
}

describe('LedgerSwitcherSheet', () => {
  it('opens as a modal listing every ledger', () => {
    renderSheet()
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Worked out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drinking' })).toBeInTheDocument()
  })

  it('marks the active ledger with aria-current', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Worked out' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Drinking' })).not.toHaveAttribute('aria-current')
  })

  it('shows every ledger\'s resolved color dot -- no ledger ever has "no color"', () => {
    renderSheet()
    const rows = screen.getAllByRole('listitem')

    // 'a': explicit non-default color renders its own dot.
    const clayDot = rows[0].querySelector<HTMLElement>('.ledger-dot')
    expect(clayDot).toBeInTheDocument()
    expect(clayDot).toHaveStyle({ background: 'var(--ledger-color-clay)' })

    // 'b': no explicitly stored color still resolves to an Espresso dot,
    // the same color the toggle and Settings already show for it -- not a
    // missing/blank indicator.
    const unsetDot = rows[1].querySelector<HTMLElement>('.ledger-dot')
    expect(unsetDot).toBeInTheDocument()
    expect(unsetDot).toHaveStyle({ background: 'var(--ledger-color-espresso)' })

    // 'c': explicitly stored 'espresso' renders identically to the
    // resolved-default case above -- espresso is a real color, not a
    // separate "unset" concept.
    const explicitEspressoDot = rows[2].querySelector<HTMLElement>('.ledger-dot')
    expect(explicitEspressoDot).toBeInTheDocument()
    expect(explicitEspressoDot).toHaveStyle({ background: 'var(--ledger-color-espresso)' })
  })

  it('shows the resolved color dot on the active row too -- aria-current styling does not suppress it', () => {
    // 'a' (clay) is the active ledger in renderSheet()'s default activeLedgerId.
    renderSheet()
    const activeRow = screen.getByRole('button', { name: 'Worked out' }).closest('li')
    expect(activeRow?.querySelector('.ledger-dot')).toBeInTheDocument()
  })

  it('offers a quiet manage control per row and nothing else -- no inline name/color/delete controls', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Manage Worked out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Manage Drinking' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button').filter((b) => /^(Clay|Moss|Dust|Plum|Rose|Straw|None)$/.test(b.textContent ?? ''))).toHaveLength(0)
  })

  it('switching to a different ledger closes the sheet', () => {
    const { onSwitch, onDismiss } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Drinking' }))
    expect(onSwitch).toHaveBeenCalledWith('b')
    expect(onDismiss).toHaveBeenCalled()
  })

  it('tapping the already-active ledger just closes without switching', () => {
    const { onSwitch, onDismiss } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Worked out' }))
    expect(onSwitch).not.toHaveBeenCalled()
    expect(onDismiss).toHaveBeenCalled()
  })

  it('dismisses via the close control without switching', () => {
    const { onSwitch, onDismiss } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onDismiss).toHaveBeenCalled()
    expect(onSwitch).not.toHaveBeenCalled()
  })

  describe('manage', () => {
    it('hands off to the canonical Settings sheet for that ledger and closes the catalog, without switching', () => {
      const { onManage, onSwitch, onDismiss } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Drinking' }))

      expect(onManage).toHaveBeenCalledWith('b')
      expect(onSwitch).not.toHaveBeenCalled()
      expect(onDismiss).toHaveBeenCalled()
    })

    it('manages the active ledger the same way as any other', () => {
      const { onManage } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Manage Worked out' }))
      expect(onManage).toHaveBeenCalledWith('a')
    })
  })

  describe('create (adding a 2nd+ ledger)', () => {
    it('reveals the new-ledger form on demand', () => {
      renderSheet()
      expect(screen.queryByLabelText(/what are you tracking/i)).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      expect(screen.getByLabelText(/what are you tracking/i)).toBeInTheDocument()
    })

    it('starts both state labels at Yes/No, editable', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      expect(screen.getByLabelText('First state')).toHaveValue('Yes')
      expect(screen.getByLabelText('Second state')).toHaveValue('No')
    })

    it('does not show the first-time suggestions helper once the account already has a ledger', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      expect(screen.queryByText(/not sure what to note/i)).not.toBeInTheDocument()
      // A suggestion chip, not the existing "Worked out" ledger row (which
      // is legitimately in the list already).
      expect(screen.queryByRole('button', { name: 'Ate out' })).not.toBeInTheDocument()
    })

    it('offers Cancel back to the list', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('cancel collapses the form without creating', () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onCreate).not.toHaveBeenCalled()
      expect(screen.queryByLabelText(/what are you tracking/i)).not.toBeInTheDocument()
    })

    it('the "if I don\'t log anything" choices live-reflect the two state-label inputs', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      expect(screen.getByRole('radio', { name: 'Yes' })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'No' })).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('First state'), { target: { value: 'Good' } })
      fireEvent.change(screen.getByLabelText('Second state'), { target: { value: 'Rough' } })

      expect(screen.getByRole('radio', { name: 'Good' })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'Rough' })).toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: 'Yes' })).not.toBeInTheDocument()
    })

    it('there are no hardcoded "I did it"/"I didn\'t do it" choices', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      expect(screen.queryByText('I did it')).not.toBeInTheDocument()
      expect(screen.queryByText("I didn't do it")).not.toBeInTheDocument()
    })

    it('rejects an empty name', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.click(screen.getByRole('radio', { name: 'Yes' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i)
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('rejects an emptied state label', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.change(screen.getByLabelText('First state'), { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/enter a label/i)
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('requires a default-state selection', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/choose what an untouched day means/i)
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('pre-selects Espresso, the canonical default color, without requiring a color choice', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      expect(screen.getByRole('button', { name: 'Espresso' })).toHaveAttribute('aria-pressed', 'true')

      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('radio', { name: 'No' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith({
          name: 'Reading',
          defaultState: 'didnt',
          stateLabels: { did: 'Yes', didnt: 'No' },
          color: 'espresso',
        })
      })
    })

    it('creates with edited state labels, the chosen default, and a chosen color', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.change(screen.getByLabelText('First state'), { target: { value: 'Good' } })
      fireEvent.change(screen.getByLabelText('Second state'), { target: { value: 'Rough' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Good' }))
      fireEvent.click(screen.getByRole('button', { name: 'Moss' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith({
          name: 'Reading',
          defaultState: 'did',
          stateLabels: { did: 'Good', didnt: 'Rough' },
          color: 'moss',
        })
      })
    })

    it('trims whitespace from edited state labels before saving', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.change(screen.getByLabelText('First state'), { target: { value: '  Good  ' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Good' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({ stateLabels: { did: 'Good', didnt: 'No' } }),
        )
      })
    })

    it('does not offer a "None"/background swatch -- Espresso is the real default color', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      expect(screen.queryByRole('button', { name: 'None' })).not.toBeInTheDocument()
    })

    it('closes the sheet after a successful create', async () => {
      const { onDismiss } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Yes' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onDismiss).toHaveBeenCalled()
      })
    })

    it('shows an error and keeps the form open when creation fails', async () => {
      const onCreate = vi.fn().mockRejectedValue(new Error('offline'))
      renderSheet({ onCreate })

      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Yes' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
      expect(screen.getByLabelText(/what are you tracking/i)).toBeInTheDocument()
    })
  })

  describe('creating the first ledger', () => {
    function renderFirstLedgerSheet(overrides: Partial<Parameters<typeof LedgerSwitcherSheet>[0]> = {}) {
      return renderSheet({ ledgers: [], activeLedgerId: null, ...overrides })
    }

    it('opens straight into the creation form, with the name field focused, and no ledger list to browse', () => {
      renderFirstLedgerSheet()

      expect(screen.getByLabelText(/what are you tracking/i)).toHaveFocus()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })

    it('offers no Cancel -- there is nothing to browse back to', () => {
      renderFirstLedgerSheet()
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    })

    it('shows the collapsed first-time suggestions helper', () => {
      renderFirstLedgerSheet()

      const toggle = screen.getByRole('button', { name: /not sure what to note/i })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('button', { name: 'Worked out' })).not.toBeInTheDocument()
    })

    it('expands to show all six suggestions', () => {
      renderFirstLedgerSheet()
      fireEvent.click(screen.getByRole('button', { name: /not sure what to note/i }))

      expect(screen.getByRole('button', { name: 'Worked out' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ate out' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Headache' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drank alcohol' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cooked dinner' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Good day' })).toBeInTheDocument()
    })

    it('selecting a suggestion only fills the name field and collapses the helper', () => {
      renderFirstLedgerSheet()
      fireEvent.click(screen.getByRole('button', { name: /not sure what to note/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Headache' }))

      expect(screen.getByLabelText(/what are you tracking/i)).toHaveValue('Headache')
      expect(screen.queryByRole('button', { name: 'Worked out' })).not.toBeInTheDocument()
    })

    it('a selected suggestion remains freely editable, not a locked template', async () => {
      const { onCreate } = renderFirstLedgerSheet()
      fireEvent.click(screen.getByRole('button', { name: /not sure what to note/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Good day' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Meditated' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Yes' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Meditated' }),
        )
      })
      expect(onCreate.mock.calls[0][0]).not.toHaveProperty('category')
    })

    it('still requires and persists editable state labels and a default choice for the first ledger', async () => {
      const { onCreate } = renderFirstLedgerSheet()
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Headache' } })
      fireEvent.change(screen.getByLabelText('First state'), { target: { value: 'Had one' } })
      fireEvent.change(screen.getByLabelText('Second state'), { target: { value: "Didn't" } })
      fireEvent.click(screen.getByRole('radio', { name: "Didn't" }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith({
          name: 'Headache',
          defaultState: 'didnt',
          stateLabels: { did: 'Had one', didnt: "Didn't" },
          color: 'espresso',
        })
      })
    })
  })
})
