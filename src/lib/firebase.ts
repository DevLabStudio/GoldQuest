// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

// Your web app's Firebase configuration
// Use environment variables if available, otherwise fallback to provided defaults
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDMq0mZrKW_FguLwdlYzH7SV4PP67mPvOk",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "financiosimples.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://financiosimples-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "financiosimples",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "financiosimples.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "628788872755",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:628788872755:web:3e407d6120cb9e05ab8546",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-K2XNJ9F87T" // Optional
};

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let databaseInstance: Database | null = null;
let googleAuthProviderInstance: GoogleAuthProvider | null = null;
let firebaseInitialized = false;
let firebaseInitializationError: string | null = null;

// Critical config keys that must be present and non-empty
const criticalConfigKeysMap: { [key in keyof typeof firebaseConfig]?: string } = {
  apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY or fallback',
  authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN or fallback',
  projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID or fallback',
  databaseURL: 'NEXT_PUBLIC_FIREBASE_DATABASE_URL or fallback',
  // Add other keys if they are absolutely critical for your app's core Firebase functionality
};

for (const key of Object.keys(criticalConfigKeysMap) as (keyof typeof firebaseConfig)[]) {
    const value = firebaseConfig[key];
    const envVarName = criticalConfigKeysMap[key];
    if (!value || typeof value !== 'string' || value.trim() === "") {
        // This error message will now reflect that a fallback was also attempted if env var was missing
        firebaseInitializationError = `Firebase config key '${key}' (from env var ${envVarName}) is missing, empty, or invalid. Firebase features will be disabled. Please ensure all NEXT_PUBLIC_FIREBASE_* environment variables are correctly set or hardcoded fallbacks are valid.`;
        break; 
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
    console.log("Firebase initialized successfully with provided config.");
  } catch (error: any) {
    firebaseInitializationError = `Firebase SDK initialization failed: ${error.message}. This might be due to an invalid API key or project configuration. Firebase features will be disabled.`;
    console.error("Firebase SDK Initialization Error (firebase.ts catch block):", error);
    app = null;
    authInstance = null;
    databaseInstance = null;
    googleAuthProviderInstance = null;
    firebaseInitialized = false; 
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
