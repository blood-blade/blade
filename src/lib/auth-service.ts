import { 
  createUserWithEmailAndPassword as firebaseCreateUser,
  signInWithEmailAndPassword as firebaseSignIn,
  signInWithPopup as firebaseSignInPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  updateProfile,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { auth as firebaseAuth, db } from './firebase';
import { setupPresence, setOfflineStatus } from './presence-final';

// Ensure auth is defined
const auth = firebaseAuth!;

export class AuthError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

// Debug function
const logDebug = (message: string, data?: any) => {
  console.log(`[Auth Service] ${message}`, data || '');
};

export const authService = {
  /**
   * Create a new user account
   */
  async createAccount(email: string, password: string, name?: string) {
    try {
      // Clear any existing sessions
      await auth.signOut();
      
      // Wait for auth state to clear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create the user account
      const userCredential = await firebaseCreateUser(auth, email, password);
      
      if (!userCredential?.user) {
        throw new AuthError('Failed to create user account', 'auth/creation-failed');
      }
      
      // Update the user profile
      await updateProfile(userCredential.user, {
        displayName: name
      });
      
      // Create the user document
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email,
        name,
        photoURL: null,
        status: 'online',
        about: '',
        devices: [],
        background: 'galaxy',
        useCustomBackground: true,
        friends: [],
        friendRequestsSent: [],
        friendRequestsReceived: [],
        blockedUsers: [],
        mutedConversations: [],
        emailVerified: true,
        verifiedAt: new Date(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Force token refresh
      await userCredential.user.getIdToken(true);
      
      return userCredential.user;
    } catch (error: any) {
      console.error('Account creation error:', error);
      throw new AuthError(
        error.message || 'Failed to create account',
        error.code || 'auth/unknown'
      );
    }
  },

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string) {
    try {
      // Clear any existing corrupted auth state
      if (auth.currentUser) {
        await auth.signOut();
        // Clear any persisted auth data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastLogin');
          localStorage.removeItem('sessionUser');
          // Clear IndexedDB auth data
          try {
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
              if (db.name?.includes('firebase') && db.name) {
                await window.indexedDB.deleteDatabase(db.name);
              }
            }
          } catch (e) {
            console.warn('Failed to clear IndexedDB:', e);
          }
        }
        // Wait for auth state to clear
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Attempt sign in
      const userCredential = await firebaseSignIn(auth, email, password);
      
      if (!userCredential?.user) {
        throw new AuthError('Failed to sign in', 'auth/sign-in-failed');
      }

      // Setup presence system
      await setupPresence(userCredential.user.uid);

      return userCredential.user;
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new AuthError(
        error.message || 'Failed to sign in',
        error.code || 'auth/unknown'
      );
    }
  },

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    try {
      // Clear any existing auth state first
      if (auth.currentUser) {
        await auth.signOut();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Initialize Google Auth Provider
      logDebug('Initializing Google Auth Provider');
      const provider = new GoogleAuthProvider();
      
      // Configure provider settings
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set minimal custom parameters
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      logDebug('Google Auth Provider configured');
      
      // Attempt sign in with popup
      logDebug('Attempting Google sign-in with popup');
      const result = await firebaseSignInPopup(auth, provider);
      
      if (!result?.user) {
        throw new AuthError('No user returned from Google sign in', 'auth/google-sign-in-failed');
      }
      
      // Validate the authentication result
      try {
        const token = await result.user.getIdToken(true);
        if (!token) {
          throw new Error('Failed to obtain valid token');
        }
      } catch (e) {
        throw new AuthError('Session validation failed', 'auth/invalid-session');
      }
      
      // Check if user document exists
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (!userDoc.exists()) {
        // Create new user document
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email ?? '',
          name: result.user.displayName ?? (result.user.email ? result.user.email.split('@')[0] : 'User'),
          photoURL: result.user.photoURL ?? '',
          status: 'online',
          about: '',
          devices: [],
          background: 'galaxy',
          useCustomBackground: true,
          friends: [],
          friendRequestsSent: [],
          friendRequestsReceived: [],
          blockedUsers: [],
          mutedConversations: [],
          emailVerified: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Update online status
        await setupPresence(result.user.uid);
      }
      
      return result.user;
    } catch (error: any) {
      console.error('Google sign in error:', error);
      throw new AuthError(
        error.message || 'Failed to sign in with Google',
        error.code || 'auth/unknown'
      );
    }
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          status: 'offline',
          lastSeen: serverTimestamp()
        });
      }
      await firebaseSignOut(firebaseAuth);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new AuthError(
        error.message || 'Failed to sign out',
        error.code || 'auth/unknown'
      );
    }
  }
};