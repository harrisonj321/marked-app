import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

export type { User }

export function subscribeAuthUser(onChange: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, onChange)
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider())
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}
