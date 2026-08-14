import { useEffect, useRef, type MouseEvent } from 'react'
import type { Ledger } from '../domain/ledger'
import { Calendar } from './Calendar'
import { CloseIcon } from './icons'

interface CalendarSheetProps {
  uid: string
  ledger: Ledger
  todayKey: string
  onDismiss: () => void
}

export function CalendarSheet({ uid, ledger, todayKey, onDismiss }: CalendarSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="calendar-sheet"
      aria-label="Calendar"
      onClose={onDismiss}
      onClick={handleBackdropClick}
    >
      <div className="calendar-sheet-header">
        <button
          type="button"
          className="icon-button"
          aria-label="Close calendar"
          onClick={() => dialogRef.current?.close()}
        >
          <CloseIcon />
        </button>
      </div>
      <Calendar uid={uid} ledger={ledger} todayKey={todayKey} />
    </dialog>
  )
}
