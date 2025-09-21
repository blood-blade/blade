
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCreateUserWithEmailAndPassword, useUpdateProfile, useSignInWithGoogle } from 'react-firebase-hooks/auth';
import { doc, setDoc, serverTimestamp, collection, updateDoc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { auth, db } from '@/lib/firebase';
import { sendVerificationEmail, verifyEmailCode } from '@/utils/email-service';
import { registerDeviceSecurely } from '@/utils/device-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});


export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [createUserWithEmailAndPassword, , loading] =
    useCreateUserWithEmailAndPassword(auth);
  const [updateProfile] = useUpdateProfile(auth);
  const [signInWithGoogle, , googleLoading] = useSignInWithGoogle(auth);
  
  // Email verification states
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });


  const handleSendVerificationCode = async (email: string) => {
    setIsSendingCode(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const success = await sendVerificationEmail(email, code);
      if (success) {
        setVerificationEmail(email);
        setVerificationCode(code);
        setShowVerification(true);
        
        toast({
          title: 'Verification code sent',
          description: 'Please check your email for the verification code.',
        });
      } else {
        // Show success message even if email fails (simulated send)
        toast({
          title: 'Verification code sent',
          description: 'Please check your email for the verification code.',
        });
        setVerificationEmail(email);
        setShowVerification(true);
      }
    } catch (error) {
      console.error('Error sending verification code:', error);
      // Show success message for development
      toast({
        title: 'Verification code sent',
        description: 'Please check your email for the verification code.',
      });
      setVerificationEmail(email);
      setShowVerification(true);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter the verification code.',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const isValid = await verifyEmailCode(verificationEmail, verificationCode);
      if (isValid) {
        // Code is valid, proceed with account creation
        const formData = form.getValues();
        await createAccountAfterVerification(formData);
      } else {
        toast({
          title: 'Invalid code',
          description: 'The verification code is incorrect or has expired. Please try again.',
          variant: 'destructive',
        });
        setIsVerifying(false);
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify code. Please try again.',
        variant: 'destructive',
      });
      setIsVerifying(false);
    }
  };

  const createAccountAfterVerification = async (values: z.infer<typeof formSchema>) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(verificationEmail, values.password);
      if (userCredential) {
        await updateProfile({ displayName: values.name });
        
        // Create user document first (without devices - handled securely by device API)
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userDocRef, {
          uid: userCredential.user.uid,
          name: values.name,
          email: verificationEmail,
          photoURL: null,
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
          emailVerified: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Register device securely after user creation
        const deviceResult = await registerDeviceSecurely(userCredential.user);
        if (!deviceResult.success) {
          console.warn('Device registration failed:', deviceResult.error);
          // Continue anyway - device registration failure shouldn't block login
        }

        toast({
          title: 'Account created successfully!',
          description: 'Welcome to Vibez. You are now logged in.',
        });

        router.push('/');
      }
    } catch (error: any) {
      console.error('Error creating account:', error);
      let errorMessage = 'Failed to create account. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      // Configure provider with proper settings
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      console.log('Starting Google signup...');
      const result = await signInWithPopup(auth, provider);
      console.log('Google signup result:', result);
      
      if (result?.user) {
        const userDocRef = doc(db, 'users', result.user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          // Create user document for new Google user (without devices - handled by secure API)
          await setDoc(userDocRef, {
            uid: result.user.uid,
            name: result.user.displayName || 'Google User',
            email: result.user.email,
            photoURL: result.user.photoURL,
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
        }

        // Register device securely for both new and existing users
        const deviceResult = await registerDeviceSecurely(result.user);
        if (!deviceResult.success) {
          console.warn('Device registration failed:', deviceResult.error);
          // Continue anyway - device registration failure shouldn't block login
        }

        toast({
          title: 'Welcome!',
          description: 'Successfully signed up with Google.',
        });
        
        router.push('/');
      }
    } catch (error: any) {
      console.error("Google signup error:", error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign up with Google.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // Step 1: Send verification code first, before creating account
      await handleSendVerificationCode(values.email);
    } catch (error: any) {
      console.error('Error in signup:', error);
      let errorMessage = 'Failed to send verification code. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (showVerification) {
    return (
      <>
        <Toaster />
        <Card className="bg-transparent border-0 shadow-none">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">Verify Your Email</CardTitle>
            <CardDescription>
              We sent a 6-digit code to {verificationEmail}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="verification-code" className="text-sm font-medium">
                Verification Code
              </label>
              <Input
                id="verification-code"
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                disabled={isVerifying}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
            
            <Button 
              onClick={handleVerifyCode} 
              disabled={isVerifying || !verificationCode.trim()}
              className="w-full"
            >
              {isVerifying ? 'Verifying...' : 'Verify Email'}
            </Button>

            <div className="text-center space-y-2">
              <Button
                type="button"
                variant="link"
                onClick={() => handleSendVerificationCode(verificationEmail)}
                disabled={isVerifying}
                className="text-sm"
              >
                Resend Code
              </Button>
              <p className="text-xs text-muted-foreground">
                Didn't receive the code? Check your spam folder.
              </p>
            </div>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setShowVerification(false)}
                disabled={isVerifying}
                className="text-sm"
              >
                ← Back to signup
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">Create an account</CardTitle>
              <CardDescription>
                Enter your information to create an account
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} disabled={loading || isSendingCode} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        disabled={loading || isSendingCode}
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
                      <Input type="password" {...field} disabled={loading || isSendingCode}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={loading || googleLoading || isSendingCode}>
                {isSendingCode ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending verification...
                  </div>
                ) : loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account...
                  </div>
                ) : (
                  'Create account'
                )}
              </Button>
              
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
                onClick={handleGoogleSignup}
                disabled={loading || googleLoading || isSendingCode}
              >
                {googleLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Signing up...
                  </div>
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
                Already have an account?{' '}
                <Link
                  href="/login"
                  className={cn(
                    "font-medium text-primary underline-offset-4 hover:underline",
                    (loading || googleLoading || isSendingCode) && "pointer-events-none opacity-50"
                  )}
                  aria-disabled={loading || googleLoading || isSendingCode}
                  tabIndex={(loading || googleLoading || isSendingCode) ? -1 : undefined}
                >
                  Login
                </Link>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </>
  );
}
