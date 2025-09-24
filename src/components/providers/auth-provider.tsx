'use client';

import { auth } from '@/lib/firebase';
import { signOut as firebaseSignOut, Auth, getRedirectResult, User } from 'firebase/auth';
import React, { createContext, ReactNode, useEffect, useState, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { usePathname, useRouter } from 'next/navigation';
import { VibezLogo } from '../vibez-logo';
import { GalaxyBackground } from '../galaxy-background';
import { getDoc, doc, updateDoc, serverTimestamp, DocumentData } from 'firebase/firestore';
import { db, setupPresence } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error?: Error;
  signOut: () => Promise<void>;
  auth: Auth;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_ROUTES = ['/login', '/signup', '/verify-email'];

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black relative">
      <GalaxyBackground />
      <div className="relative z-10">
        <VibezLogo />
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, authLoading, error] = useAuthState(auth);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Navigation state management
  const navigationInProgress = useRef(false);
  const lastRedirectTime = useRef(Date.now());
  const REDIRECT_COOLDOWN = 2000; // 2 seconds cooldown between redirects
  const VERIFICATION_CHECK_COOLDOWN = 5000; // 5 seconds between verification checks

  useEffect(() => {
    // Check for redirect result on initial load
    getRedirectResult(auth)
      .finally(() => {
        setIsProcessingRedirect(false);
      });
  }, []);

  useEffect(() => {
    const isAuthRoute = AUTH_ROUTES.includes(pathname || '');
    const isLoading = authLoading || isProcessingRedirect;

    const handleAuth = async () => {
      if (isLoading || navigationInProgress.current) return;

      // Prevent rapid redirects
      const now = Date.now();
      if (now - lastRedirectTime.current < REDIRECT_COOLDOWN) {
        return;
      }

      // Handle authentication routes
      if (user && isAuthRoute && pathname !== '/verify-email') {
        lastRedirectTime.current = now;
        navigationInProgress.current = true;
        router.replace('/');
        setTimeout(() => { navigationInProgress.current = false; }, 100);
        return;
      }

      if (!user && !isAuthRoute) {
        lastRedirectTime.current = now;
        navigationInProgress.current = true;
        router.replace('/login');
        setTimeout(() => { navigationInProgress.current = false; }, 100);
        return;
      }

      // Handle email verification
      if (user && !isAuthRoute && pathname !== '/verify-email') {
        try {
          // Check if we should verify again
          const now = Date.now();
          const lastVerificationCheck = parseInt(sessionStorage.getItem(`lastVerificationCheck_${user.uid}`) || '0');
          
          if (now - lastVerificationCheck < VERIFICATION_CHECK_COOLDOWN) {
            const cachedStatus = sessionStorage.getItem(`emailVerified_${user.uid}`);
            if (cachedStatus === 'true') return;
          }
          
          sessionStorage.setItem(`lastVerificationCheck_${user.uid}`, now.toString());
          
          // Get user document
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data() as DocumentData | undefined;
          
          const isVerified = user.emailVerified || userData?.emailVerified;
          sessionStorage.setItem(`emailVerified_${user.uid}`, isVerified.toString());

          if (isVerified) {
            if (user.emailVerified && !userData?.emailVerified) {
              await updateDoc(doc(db, 'users', user.uid), {
                emailVerified: true,
                verifiedAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
              });
            }
            return;
          }

          // Handle unverified user
          const lastVerifyRedirect = parseInt(sessionStorage.getItem(`lastVerifyRedirect_${user.uid}`) || '0');
          if (now - lastVerifyRedirect >= REDIRECT_COOLDOWN && !navigationInProgress.current) {
            sessionStorage.setItem(`lastVerifyRedirect_${user.uid}`, now.toString());
            lastRedirectTime.current = now;
            navigationInProgress.current = true;
            router.replace(`/verify-email?email=${encodeURIComponent(user.email || '')}`);
            setTimeout(() => { navigationInProgress.current = false; }, 100);
          }
        } catch (error) {
          console.error('Error checking email verification:', error);
          const cachedStatus = sessionStorage.getItem(`emailVerified_${user.uid}`);
          if (cachedStatus === 'true') return;
        }
      }
    };

    handleAuth();
  }, [user, authLoading, isProcessingRedirect, pathname, router]);

  // Setup presence system when user logs in
  useEffect(() => {
    if (user?.uid) {
      setupPresence(user.uid);
    }
  }, [user?.uid]);

  const signOut = async () => {
    if (user?.uid) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          status: 'offline',
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating offline status:', error);
      }
    }
    await firebaseSignOut(auth);
  };

  const isLoading = authLoading || isProcessingRedirect;
  const isAuthRoute = AUTH_ROUTES.includes(pathname || '');

  // Show loading screen if we're still loading or if we're about to redirect
  if (isLoading || (!user && !isAuthRoute) || (user && isAuthRoute)) {
    return <LoadingScreen />;
  }

  return (
    <AuthContext.Provider value={{ user, loading: authLoading, error, signOut, auth }}>
      {children}
    </AuthContext.Provider>
  );
}