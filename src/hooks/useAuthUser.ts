import { useEffect, useState } from 'react'
import { subscribeAuthUser, type User } from '../lib/auth'

export interface AuthUserState {
  user: User | null
  loading: boolean
}

export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ user: null, loading: true })

  useEffect(() => {
    return subscribeAuthUser((user) => setState({ user, loading: false }))
  }, [])

  return state
}
