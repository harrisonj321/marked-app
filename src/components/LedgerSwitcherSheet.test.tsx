import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
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

    it('shows a compact form: name, Default state, Marked state, color, and Save -- no Yes/No radios or a Customize disclosure', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      expect(screen.getByLabelText(/what are you tracking/i)).toBeInTheDocument()
      expect(screen.getByLabelText('Default state')).toBeInTheDocument()
      expect(screen.getByLabelText('Marked state')).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Color' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Customize states' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('First state')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Second state')).not.toBeInTheDocument()
    })

    it('both state-label fields start genuinely empty -- no initial value, just placeholder text', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      expect(screen.getByLabelText('Default state')).toHaveValue('')
      expect(screen.getByLabelText('Marked state')).toHaveValue('')
    })

    it('shows the helper copy explaining what the default field means', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      expect(screen.getByText("If I don't log anything, count the day as:")).toBeInTheDocument()
    })

    it('the placeholder pair is synchronized and cycles together on a timer', () => {
      vi.useFakeTimers()
      try {
        renderSheet()
        fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

        const defaultField = screen.getByLabelText('Default state')
        const markedField = screen.getByLabelText('Marked state')
        const firstDefault = defaultField.getAttribute('placeholder')
        const firstMarked = markedField.getAttribute('placeholder')

        act(() => {
          vi.advanceTimersByTime(3000)
        })

        const secondDefault = defaultField.getAttribute('placeholder')
        const secondMarked = markedField.getAttribute('placeholder')

        // The pair changed together, not independently.
        expect(secondDefault).not.toBe(firstDefault)
        expect(secondMarked).not.toBe(firstMarked)
      } finally {
        vi.useRealTimers()
      }
    })

    it('focusing a field clears its placeholder to a normal blank input, without animating', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      const defaultField = screen.getByLabelText('Default state')
      expect(defaultField.getAttribute('placeholder')).not.toBe('')
      fireEvent.focus(defaultField)
      expect(defaultField).toHaveAttribute('placeholder', '')
    })

    it('blurring an empty field resumes the cycling placeholder', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      const defaultField = screen.getByLabelText('Default state')
      fireEvent.focus(defaultField)
      expect(defaultField).toHaveAttribute('placeholder', '')
      fireEvent.blur(defaultField)
      expect(defaultField.getAttribute('placeholder')).not.toBe('')
    })

    it('typing a value keeps it after blur -- it is never silently replaced by the placeholder', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      const defaultField = screen.getByLabelText('Default state')
      fireEvent.focus(defaultField)
      fireEvent.change(defaultField, { target: { value: 'Rest day' } })
      fireEvent.blur(defaultField)

      expect(defaultField).toHaveValue('Rest day')
    })

    it('does not show the first-time suggestions helper once the account already has a ledger', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))

      expect(screen.queryByText(/not sure what to mark/i)).not.toBeInTheDocument()
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

    it('re-opening after Cancel starts fresh: both state-label fields empty again', () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: 'Rough' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      expect(screen.getByLabelText('Default state')).toHaveValue('')
      expect(screen.getByLabelText('Marked state')).toHaveValue('')
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
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: 'No' } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Yes' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i)
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('requires an actual value in the Default state field -- placeholder text alone does not count', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Yes' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/enter a label/i)
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('requires an actual value in the Marked state field', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: 'No' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/enter a label/i)
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('rejects a whitespace-only state label', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: '   ' } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Yes' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/enter a label/i)
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('persists the Default state field as the ledger default and the Marked state field as the other state, with a chosen color', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: 'Rough' } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Good' } })
      fireEvent.click(screen.getByRole('button', { name: 'Moss' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith({
          name: 'Reading',
          defaultState: 'didnt',
          stateLabels: { didnt: 'Rough', did: 'Good' },
          color: 'moss',
        })
      })
    })

    it('trims whitespace from entered state labels before saving', async () => {
      const { onCreate } = renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'New ledger' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: '  Rough  ' } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: '  Good  ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({ stateLabels: { didnt: 'Rough', did: 'Good' } }),
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
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: 'No' } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Yes' } })
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
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: 'No' } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Yes' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.')
      expect(screen.getByLabelText(/what are you tracking/i)).toBeInTheDocument()
    })

    describe('normal dismissal, once at least one ledger exists', () => {
      it('shows the X close control', () => {
        renderSheet()
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
      })

      it('backdrop click closes the sheet', () => {
        const { onDismiss } = renderSheet()
        const dialog = document.querySelector('dialog')!
        fireEvent.click(dialog)
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
        expect(onDismiss).toHaveBeenCalled()
      })

      it('does not block the native Escape/cancel dismissal', () => {
        renderSheet()
        const dialog = document.querySelector('dialog')!
        const event = new Event('cancel', { cancelable: true })
        dialog.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(false)
      })
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

    it('shows the same compact form as adding any later ledger -- Default state and Marked state fields, no radios or a Customize disclosure', () => {
      renderFirstLedgerSheet()

      expect(screen.getByLabelText('Default state')).toBeInTheDocument()
      expect(screen.getByLabelText('Marked state')).toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Customize states' })).not.toBeInTheDocument()
    })

    it('offers no Cancel -- there is nothing to browse back to', () => {
      renderFirstLedgerSheet()
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    })

    it('offers no X close control', () => {
      renderFirstLedgerSheet()
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    })

    it('a backdrop click does not close the sheet', () => {
      const { onDismiss } = renderFirstLedgerSheet()
      const dialog = document.querySelector('dialog')!
      fireEvent.click(dialog)

      expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled()
      expect(onDismiss).not.toHaveBeenCalled()
      expect(screen.getByLabelText(/what are you tracking/i)).toBeInTheDocument()
    })

    it('Escape/the native cancel event is prevented, so it cannot dismiss the sheet', () => {
      renderFirstLedgerSheet()
      const dialog = document.querySelector('dialog')!
      const event = new Event('cancel', { cancelable: true })
      dialog.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
      expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled()
    })

    it('the only way out is creating a ledger, which does close it', async () => {
      const { onCreate, onDismiss } = renderFirstLedgerSheet()
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Reading' } })
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: 'No' } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Yes' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalled()
        expect(onDismiss).toHaveBeenCalled()
      })
    })

    it('shows the collapsed first-time suggestions helper', () => {
      renderFirstLedgerSheet()

      const toggle = screen.getByRole('button', { name: /not sure what to mark/i })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('button', { name: 'Worked out' })).not.toBeInTheDocument()
    })

    it('expands to show all six suggestions', () => {
      renderFirstLedgerSheet()
      fireEvent.click(screen.getByRole('button', { name: /not sure what to mark/i }))

      expect(screen.getByRole('button', { name: 'Worked out' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ate out' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Headache' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drank alcohol' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cooked dinner' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Good day' })).toBeInTheDocument()
    })

    it('selecting a suggestion only fills the name field and collapses the helper', () => {
      renderFirstLedgerSheet()
      fireEvent.click(screen.getByRole('button', { name: /not sure what to mark/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Headache' }))

      expect(screen.getByLabelText(/what are you tracking/i)).toHaveValue('Headache')
      expect(screen.queryByRole('button', { name: 'Worked out' })).not.toBeInTheDocument()
    })

    it('a selected suggestion remains freely editable, not a locked template', async () => {
      const { onCreate } = renderFirstLedgerSheet()
      fireEvent.click(screen.getByRole('button', { name: /not sure what to mark/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Good day' }))
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Meditated' } })
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: 'No' } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Yes' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Meditated' }),
        )
      })
      expect(onCreate.mock.calls[0][0]).not.toHaveProperty('category')
    })

    it('requires and persists real entered state labels for the first ledger too', async () => {
      const { onCreate } = renderFirstLedgerSheet()
      fireEvent.change(screen.getByLabelText(/what are you tracking/i), { target: { value: 'Headache' } })
      fireEvent.change(screen.getByLabelText('Default state'), { target: { value: "Didn't" } })
      fireEvent.change(screen.getByLabelText('Marked state'), { target: { value: 'Had one' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await vi.waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith({
          name: 'Headache',
          defaultState: 'didnt',
          stateLabels: { didnt: "Didn't", did: 'Had one' },
          color: 'espresso',
        })
      })
    })
  })
})
