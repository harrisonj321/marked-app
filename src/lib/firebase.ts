import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const rawConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function assertFirebaseConfig(
  values: Record<string, string | undefined>,
): FirebaseOptions {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(
      `Missing required Firebase environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in your Firebase web app configuration.',
    )
  }

  return values as FirebaseOptions
}

const firebaseConfig = assertFirebaseConfig(rawConfig)

// Only Authentication and Firestore are Marked. features. Storage and
// Analytics must not be initialized even though the standard Firebase
// web config shape includes a storage bucket value.
export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Local-emulator wiring for development against the Firebase Emulator
// Suite (never bundled into production builds; also gated on an opt-in
// env flag so plain `npm run dev` still talks to the real project).
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
