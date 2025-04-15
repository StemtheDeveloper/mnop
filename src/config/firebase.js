// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  updateProfile,
  GoogleAuthProvider,
} from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import "firebase/firestore";

/**
 * Firebase configuration object
 * Values are loaded from environment variables
 * Environment variables must be prefixed with VITE_ to be accessible in client-side code
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Check that environment variables are properly loaded
if (!firebaseConfig.apiKey) {
  console.error(
    "Firebase API key is missing. Make sure your .env file contains VITE_FIREBASE_API_KEY"
  );
}

// Show which environment variables are missing
const requiredEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !import.meta.env[varName]
);
if (missingEnvVars.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

// Initialize Firebase
let app;
let analytics = null;
let storage = null;
let db = null;
let auth = null;

try {
  app = initializeApp(firebaseConfig);

  // Initialize Analytics in production only
  analytics =
    import.meta.env.VITE_APP_ENV === "production" ? getAnalytics(app) : null;

  // Initialize Firebase services
  storage = getStorage(app);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

export const timestamp = serverTimestamp();
const googleProvider = new GoogleAuthProvider();

// Export Firebase services
export { db, storage, auth, analytics };

// Export Firebase authentication functions
export { onAuthStateChanged, signOut, updateProfile, googleProvider };

// Export the app as default
export default app;
