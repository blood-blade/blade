// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID
};

// Validate required Firebase config
const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingConfig = requiredConfig.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingConfig.length > 0) {
  console.error('Missing Firebase configuration:', missingConfig);
  console.error('Current config values:', {
    apiKey: firebaseConfig.apiKey ? 'SET' : 'MISSING',
    authDomain: firebaseConfig.authDomain ? 'SET' : 'MISSING',
    projectId: firebaseConfig.projectId ? 'SET' : 'MISSING',
    appId: firebaseConfig.appId ? 'SET' : 'MISSING',
  });
  throw new Error(`Missing Firebase configuration: ${missingConfig.join(', ')}. Please check your environment variables.`);
}

// Debug configuration loading
console.log('Firebase config loading:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  currentDomain: typeof window !== 'undefined' ? window.location.hostname : 'server',
  apiKeyPrefix: firebaseConfig.apiKey?.substring(0, 5),
});

// Validate API key format
if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('AIza')) {
  console.error('Invalid Firebase API key format. API key should start with "AIza"');
  throw new Error('Invalid Firebase API key format');
}

// Log current domain for debugging
if (typeof window !== 'undefined') {
  console.log('Current domain:', window.location.hostname);
  console.log('Current origin:', window.location.origin);
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
console.log('Firebase app initialized successfully');

// Initialize Firebase Auth with persistence
import { setPersistence, browserLocalPersistence } from 'firebase/auth';
export const auth = getAuth(app);

// Set persistence to LOCAL (survives browser restarts)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Firebase Auth persistence set to LOCAL');
  })
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

// Configure auth for Replit domains
if (typeof window !== 'undefined') {
  const currentDomain = window.location.hostname;
  console.log('Current domain:', currentDomain);
  console.log('Current origin:', window.location.origin);

  // Add current domain to authorized domains for development
  if (currentDomain.includes('.replit.dev') || currentDomain.includes('.repl.co')) {
    // Replit domains are automatically handled by Firebase
    console.log('Running on Replit domain, auth should work automatically');
  }
}

// Initialize Firestore with offline persistence
import { enableIndexedDbPersistence, getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager, Firestore } from 'firebase/firestore';

// Initialize Firestore only if it hasn't been initialized yet
let db: Firestore;
try {
  // Try to get existing Firestore instance
  db = getFirestore(app);
} catch (e) {
  // If no instance exists, initialize with persistence settings
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true })
    })
  });
}

// Enable offline persistence only if it hasn't been enabled
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed to enable. Multiple tabs might be open.');
    } else if (err.code === 'unimplemented') {
      console.warn('Browser doesn\'t support persistence');
    }
  });
} catch (err: any) {
  if (err?.code !== 'persistence-already-enabled') {
    console.error('Error enabling persistence:', err);
  }
}

// Handle user online presence
import { ref, onDisconnect, set, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { doc, updateDoc, serverTimestamp as firestoreServerTimestamp, onSnapshot } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// Initialize Realtime Database for presence
const rtdb = getDatabase(app);

// Function to handle user presence
export const setupPresence = (uid: string) => {
  if (!uid) return;

  // Firestore reference
  const userDocRef = doc(db, 'users', uid);
  
  // Realtime Database reference for presence
  const userStatusRef = ref(rtdb, `/status/${uid}`);
  
  // Create presence system
  const updatePresence = async (isOnline: boolean) => {
    try {
      const status = {
        state: isOnline ? 'online' : 'offline',
        lastChanged: rtServerTimestamp(),
      };
      
      // Update realtime database
      await set(userStatusRef, status);
      
      // Update Firestore
      await updateDoc(userDocRef, {
        status: status.state,
        lastSeen: firestoreServerTimestamp()
      });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  // Set up disconnect hook
  onDisconnect(userStatusRef)
    .set({
      state: 'offline',
      lastChanged: rtServerTimestamp(),
    })
    .then(() => {
      // Set initial online status
      updatePresence(true);
    });

  // Handle visibility change
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      updatePresence(document.visibilityState === 'visible');
    });
  }
};

export { db };

// Initialize Firebase Storage
export const storage = getStorage(app);

// Export Firestore functions
export { setDoc };

// Add error handler for unhandled Firestore errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.warn('Firestore request was blocked. This might be caused by an ad blocker or privacy extension.');
    }
  });
}