import { Wordmark } from './Wordmark'

export function LoadingScreen() {
  return (
    <main className="screen screen-center" aria-busy="true" aria-label="Loading">
      <Wordmark className="brand" />
    </main>
  )
}
