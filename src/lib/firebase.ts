// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let databaseInstance: Database | null = null;
let googleAuthProviderInstance: GoogleAuthProvider | null = null;
let firebaseInitialized = false;
let firebaseInitializationError: string | null = null;

// Critical config keys that must be present and non-empty
const criticalConfigKeysMap: { [key in keyof typeof firebaseConfig]?: string } = {
  apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  databaseURL: 'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
  // Add other keys if they are absolutely critical for your app's core Firebase functionality
};

for (const key of Object.keys(criticalConfigKeysMap) as (keyof typeof firebaseConfig)[]) {
    const value = firebaseConfig[key];
    const envVarName = criticalConfigKeysMap[key];
    if (!value || typeof value !== 'string' || value.trim() === "") {
        firebaseInitializationError = `Firebase config key '${key}' (env: ${envVarName}) is missing, empty, or invalid. Firebase features will be disabled. Please ensure all NEXT_PUBLIC_FIREBASE_* environment variables are correctly set.`;
        break; // Stop at the first missing/empty critical key
    }
}

if (firebaseInitializationError) {
    console.error(`Firebase Initialization Error: ${firebaseInitializationError}`);
    // firebaseInitialized remains false by default, and instances remain null
} else {
  // All critical keys seem superficially OK, attempt initialization
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    authInstance = getAuth(app);
    databaseInstance = getDatabase(app);
    googleAuthProviderInstance = new GoogleAuthProvider();
    firebaseInitialized = true;
    console.log("Firebase initialized successfully.");
  } catch (error: any) {
    // This catch is for errors *during* Firebase SDK initialization itself
    // (e.g., network, or if Firebase itself deems a non-empty key invalid for some reason)
    firebaseInitializationError = `Firebase SDK initialization failed: ${error.message}. This might be due to an invalid API key or project configuration. Firebase features will be disabled.`;
    console.error("Firebase SDK Initialization Error (firebase.ts catch block):", error);
    app = null;
    authInstance = null;
    databaseInstance = null;
    googleAuthProviderInstance = null;
    firebaseInitialized = false; // Explicitly set to false on SDK error
  }
}

export {
    app as firebaseApp,
    authInstance as auth,
    databaseInstance as database,
    googleAuthProviderInstance as googleAuthProvider,
    firebaseInitialized,
    firebaseInitializationError
};
