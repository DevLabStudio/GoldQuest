// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, // Added for Realtime Database
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// Validate that all required environment variables are set
if (!firebaseConfig.apiKey) {
    throw new Error("Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is not defined. Please ensure it is set in your environment variables. This is required to initialize Firebase.");
}
if (!firebaseConfig.authDomain) {
    throw new Error("Firebase Auth Domain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) is not defined.");
}
if (!firebaseConfig.projectId) {
    throw new Error("Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is not defined.");
}
if (!firebaseConfig.databaseURL) { // Check for databaseURL as well
    throw new Error("Firebase Database URL (NEXT_PUBLIC_FIREBASE_DATABASE_URL) is not defined.");
}


// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const database = getDatabase(app); // Initialize Realtime Database
const googleAuthProvider = new GoogleAuthProvider();

export { app, auth, database, googleAuthProvider };
