import { initializeApp, getApps } from 'firebase/app';
import { 
  browserLocalPersistence, 
  indexedDBLocalPersistence, 
  initializeAuth,
  getAuth
} from 'firebase/auth';

let app;

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

// Validate required config values
if (!firebaseConfig.apiKey) {
  throw new Error('Missing required Firebase configuration key: apiKey');
}
if (!firebaseConfig.authDomain) {
  throw new Error('Missing required Firebase configuration key: authDomain');
}
if (!firebaseConfig.projectId) {
  throw new Error('Missing required Firebase configuration key: projectId');
}

// Initialize Firebase early
export function initializeFirebase() {
  try {
    // Debug: Log Firebase config
    console.log('Firebase Config:', {
      apiKey: !!firebaseConfig.apiKey,
      authDomain: !!firebaseConfig.authDomain,
      projectId: !!firebaseConfig.projectId,
      hasAllRequired: !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
    });
    
    // Initialize or get the Firebase app
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

    let auth;
    try {
      // Try to initialize auth with persistence
      auth = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        popupRedirectResolver: undefined
      });
    } catch (authError: any) {
      if (authError.code === 'auth/already-initialized') {
        // If auth is already initialized, get the existing instance
        auth = getAuth(app);
      } else {
        throw authError;
      }
    }

    return { app, auth };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
}

// Initialize with retry mechanism
function initializeWithRetry(maxRetries = 3): { app: any, auth: any } {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return initializeFirebase();
    } catch (error) {
      lastError = error;
      console.warn(`Firebase initialization attempt ${i + 1} failed:`, error);
      // Clear any stale initialization data
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        try {
          indexedDB.deleteDatabase('firebaseLocalStorageDb');
        } catch (e) {
          console.warn('Failed to clear IndexedDB:', e);
        }
      }
    }
  }
  throw lastError;
}

// Initialize with retry mechanism
export const { app: firebaseApp, auth: firebaseAuth } = initializeWithRetry();