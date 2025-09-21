'use client';
import { auth } from '@/lib/firebase';
import { signOut as firebaseSignOut, Auth, getRedirectResult } from 'firebase/auth';
import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { usePathname, useRouter } from 'next/navigation';
import { VibezLogo } from '../vibez-logo';
import { GalaxyBackground } from '../galaxy-background';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';


interface AuthContextType {
  user: any;
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
    )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, authLoading, error] = useAuthState(auth);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check for redirect result on initial load
    getRedirectResult(auth)
      .finally(() => {
        setIsProcessingRedirect(false);
      });
  }, []);

  useEffect(() => {
    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const isLoading = authLoading || isProcessingRedirect;

    const handleAuth = async () => {
      if (!isLoading) {
        if (user && isAuthRoute) {
          router.replace('/');
        } else if (!user && !isAuthRoute) {
          router.replace('/login');
        } else if (user && !isAuthRoute) {
          // Only enforce email verification for users who are definitively unverified
          // Check Firebase auth user emailVerified flag first
          if (user.emailVerified === false) {
            try {
              // Double check with user document to avoid false positives
              const userDoc = await getDoc(doc(db, 'users', user.uid));
              
              // Only sign out if BOTH Firebase auth AND document confirm unverified status
              // AND the document explicitly has emailVerified set to false (not undefined/missing)
              if (userDoc.exists()) {
                const userData = userDoc.data();
                // Only enforce if document explicitly says emailVerified is false
                // If field is missing or true, allow the user through
                if (userData.emailVerified === false) {
                  await signOut();
                  router.push('/login?message=Please verify your email before logging in.');
                  return;
                }
              }
              // If document doesn't exist or emailVerified is not explicitly false, let user continue
            } catch (error) {
              console.error('Error checking email verification:', error);
              // Don't sign out on errors - let user continue to avoid loops
            }
          }
          // If Firebase auth says emailVerified is true, always let user through
        }
      }
    };

    handleAuth();
  }, [user, authLoading, isProcessingRedirect, pathname, router]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    // Don't push here, let the useEffect handle it.
  };

  const isLoading = authLoading || isProcessingRedirect;
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Show loading screen if we're still loading or if we're about to redirect.
  if (isLoading || (!user && !isAuthRoute) || (user && isAuthRoute)) {
    return <LoadingScreen />
  }

  return (
    <AuthContext.Provider value={{ user, loading: authLoading, error, signOut, auth }}>
      {children}
    </AuthContext.Provider>
  );
}