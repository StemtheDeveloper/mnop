import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// Temporary direct config for testing
const firebaseConfig = {
    apiKey: "AIzaSyDZCJD2k6B4cJbCg-lbygmhTrsiFccErS8",
    authDomain: "m-nop-39b2f.firebaseapp.com",
    projectId: "m-nop-39b2f",
    storageBucket: "m-nop-39b2f.firebasestorage.app",
    messagingSenderId: "796565177927",
    appId: "1:796565177927:web:38dd184cc05ead5e545362",
    measurementId: "G-JVKGPTSMZH"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const storage = getStorage(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Initialize services
const db = getFirestore(app);

// Export services
export { auth, db, storage };
export default app;
