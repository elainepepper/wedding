import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingFirebaseClientValues = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

// Firebase Auth validates its configuration during module evaluation. Safe,
// non-secret placeholders let the manager show a useful setup message instead
// of crashing to a blank page when a fresh local copy has no .env.local yet.
const safeFirebaseConfig = {
  apiKey: firebaseConfig.apiKey || "configuration-missing",
  authDomain: firebaseConfig.authDomain || "configuration-missing.invalid",
  projectId: firebaseConfig.projectId || "configuration-missing",
  storageBucket: firebaseConfig.storageBucket || "configuration-missing.invalid",
  messagingSenderId: firebaseConfig.messagingSenderId || "0",
  appId: firebaseConfig.appId || "1:0:web:configuration-missing",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(safeFirebaseConfig);

// getAuth checks the API key the moment this module is evaluated — which
// happens on the server while rendering /manager. That check used to throw
// right here, taking the whole page down as a 500 before the friendly "add
// your .env.local" card could ever appear. When the settings are missing or
// unusable, auth is simply absent — and the configuration error below is set,
// so the gate shows its setup card and never touches auth in that state.
let createdAuth: Auth | null = null;
let authCreationFailed = false;
try {
  createdAuth = getAuth(firebaseApp);
} catch {
  authCreationFailed = true;
}

export const firebaseClientConfigurationError = missingFirebaseClientValues.length
  ? `Missing Firebase web settings: ${missingFirebaseClientValues.join(", ")}`
  : authCreationFailed
    ? "The Firebase web settings could not be used. Check the NEXT_PUBLIC_FIREBASE_* values against the Firebase console."
    : "";

export const firebaseAuth = createdAuth as Auth;
