// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// Fallback values for Replit environment
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDemoKey1234567890abcdefghijklmnop",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vibez-demo"}.firebaseapp.com`,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vibez-demo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vibez-demo"}.appspot.com`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890abcdef",
  measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID || "G-DEMO123456",
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

// Initialize Firebase Auth with better domain handling
export const auth = getAuth(app);

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

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Export Firestore functions
export { setDoc };