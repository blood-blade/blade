'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignInWithEmailAndPassword, useSignInWithGoogle } from 'react-firebase-hooks/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState, useEffect } from 'react';
import { doc, serverTimestamp, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';

import { auth, db } from '@/lib/firebase';
import { registerDeviceSecurely } from '@/utils/device-auth';
import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import type { User } from '@/lib/types';


const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [signInWithEmailAndPassword, , loading, error] = useSignInWithEmailAndPassword(auth);
  const [signInWithGoogle, , googleLoading] = useSignInWithGoogle(auth);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log('Login attempt for email:', values.email);
    try {
      const res = await signInWithEmailAndPassword(values.email, values.password);
      console.log('Sign in result:', res);
      
      if (res) {
        console.log('User signed in successfully:', res.user.uid);
        
        // Ensure user document exists with minimal data (devices handled by secure API)
        const userDocRef = doc(db, 'users', res.user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          console.log('Creating new user document');
          // Create minimal user document if it doesn't exist
          await setDoc(userDocRef, {
            uid: res.user.uid,
            email: res.user.email,
            name: res.user.displayName || values.email.split('@')[0],
            photoURL: res.user.photoURL || null,
            status: 'online',
            about: '',
            devices: [], // Will be populated by secure device registration
            background: 'galaxy',
            useCustomBackground: true,
            friends: [],
            friendRequestsSent: [],
            friendRequestsReceived: [],
            blockedUsers: [],
            mutedConversations: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          console.log('Updating existing user status');
          // Update status for existing user
          await updateDoc(userDocRef, {
            status: 'online',
            updatedAt: serverTimestamp(),
          });
        }

        // Register device securely after login
        try {
          const deviceResult = await registerDeviceSecurely(res.user);
          if (!deviceResult.success) {
            console.warn('Device registration failed:', deviceResult.error);
            // Continue anyway - device registration failure shouldn't block login
          }
        } catch (deviceError) {
          console.warn('Device registration error (continuing anyway):', deviceError);
        }

        console.log('Login successful, redirecting to home');
        router.push('/');
      }
    } catch (e: any) {
        console.error("Login submission error:", e);
        console.error("Error code:", e.code);
        console.error("Error message:", e.message);
        
        let errorMessage = 'An unexpected error occurred. Please try again.';
        
        // Handle specific Firebase auth error codes
        switch (e.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email address. Please check your email or sign up for a new account.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password. Please check your password and try again.';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled. Please contact support.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed login attempts. Please try again later or reset your password.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          default:
            if (e.message) {
              errorMessage = e.message;
            }
        }
        
        toast({
            title: 'Login Failed',
            description: errorMessage,
            variant: 'destructive',
        });
    }
  };

  const handleForgotPassword = async () => {
    const email = form.getValues('email');
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get the current domain for the reset URL
      const currentDomain = typeof window !== 'undefined' ? window.location.origin : 
        process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` :
        'https://2b711deb-9881-4c8e-9864-f2078ec28923-00-1z7caopfvm8sp.picard.replit.dev';
      
      // Configure action code settings for the password reset email
      const actionCodeSettings = {
        url: `${currentDomain}/reset-password`,
        handleCodeInApp: false, // We want to handle the reset in the web app, not mobile
      };

      // Use Firebase's built-in sendPasswordResetEmail method
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      
      toast({
        title: 'Password reset email sent',
        description: 'Check your email for a link to reset your password. If you don\'t see it, check your spam folder.',
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      // Handle specific Firebase auth error codes
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address. Please check your email or create a new account.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many reset requests. Please wait a few minutes before trying again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again.';
          break;
        default:
          if (error.message) {
            errorMessage = error.message;
          }
      }
      
      toast({
        title: 'Error sending reset email',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Configure provider with proper settings
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      console.log('Starting Google sign-in...');
      const res = await signInWithPopup(auth, provider);
      console.log('Google sign-in result:', res);
      if (res) {
        // Ensure user document exists with minimal data (devices handled by secure API)
        const userDocRef = doc(db, 'users', res.user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // Create minimal user document for Google user
          await setDoc(userDocRef, {
            uid: res.user.uid,
            email: res.user.email,
            name: res.user.displayName || (res.user.email ? res.user.email.split('@')[0] : 'New User'),
            photoURL: res.user.photoURL || null,
            status: 'online',
            about: '',
            devices: [], // Will be populated by secure device registration
            background: 'galaxy',
            useCustomBackground: true,
            friends: [],
            friendRequestsSent: [],
            friendRequestsReceived: [],
            blockedUsers: [],
            mutedConversations: [],
            emailVerified: true, // Google accounts are pre-verified
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Update status for existing user
          await updateDoc(userDocRef, {
            status: 'online',
            updatedAt: serverTimestamp(),
          });
        }

        // Register device securely after Google login
        const deviceResult = await registerDeviceSecurely(res.user);
        if (!deviceResult.success) {
          console.warn('Device registration failed:', deviceResult.error);
          // Continue anyway - device registration failure shouldn't block login
        }

        router.push('/');
      }
    } catch (e: any) {
        console.error("Google Sign-In error:", e);
        let errorMessage = 'An unexpected error occurred. Please try again.';
        if (e.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Google sign-in was cancelled.';
        } else if (e.message) {
            errorMessage = e.message;
        }
        toast({
            title: 'Error signing in with Google',
            description: errorMessage,
            variant: 'destructive',
        });
    }
  };

  useEffect(() => {
    if (error) {
      console.error('Firebase auth hook error:', error);
      // Error handling is now done in onSubmit for better control
    }
  }, [error]);


  return (
    <>
      <Toaster />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>
                Enter your email below to log in to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@example.com"
                        {...field}
                        disabled={loading || googleLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={loading || googleLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={loading || googleLoading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-muted-foreground hover:text-primary"
                  onClick={() => handleForgotPassword()}
                  disabled={loading || googleLoading}
                >
                  Forgot your password?
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  'Signing in...'
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  href="/signup"
                  className={cn(
                    "font-medium text-primary underline-offset-4 hover:underline",
                    (loading || googleLoading) && "pointer-events-none opacity-50"
                  )}
                  aria-disabled={loading || googleLoading}
                  tabIndex={(loading || googleLoading) ? -1 : undefined}
                >
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </>
  );
}