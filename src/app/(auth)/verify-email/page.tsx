'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import React, { useState, useEffect } from 'react';
import { sendEmailVerification, User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
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
import { sendEmail } from '@/utils/email-service';

const formSchema = z.object({
  code: z.string().min(6, { message: 'Verification code must be 6 digits.' }).max(6),
});

// Generate a 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    // Get email and verification code from URL params (passed from signup)
    const email = searchParams.get('email');
    const code = searchParams.get('code');
    
    if (!email || !code) {
      toast({
        title: 'Error',
        description: 'Missing verification information. Please sign up again.',
        variant: 'destructive',
      });
      router.push('/signup');
      return;
    }
    
    setUserEmail(email);
    setVerificationCode(code);
  }, [searchParams, router, toast]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
    },
  });

  const sendVerificationEmail = async (email: string, code: string) => {
    try {
      await sendEmail({
        to: email,
        subject: 'Vibez - Email Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #6366f1; margin: 0;">Vibez</h1>
            </div>
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="margin: 0 0 20px 0;">Verify Your Email</h2>
              <p style="margin: 0 0 30px 0; font-size: 16px;">Welcome to Vibez! Please use the verification code below to complete your registration:</p>
              <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
                ${code}
              </div>
              <p style="margin: 20px 0 0 0; font-size: 14px; opacity: 0.9;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
            </div>
          </div>
        `,
        text: `Welcome to Vibez! Your verification code is: ${code}\n\nThis code will expire in 10 minutes. If you didn't request this, please ignore this email.`,
      });
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  };

  const resendCode = async () => {
    setResendLoading(true);
    try {
      const newCode = generateVerificationCode();
      await sendVerificationEmail(userEmail, newCode);
      setVerificationCode(newCode);
      
      // Update URL with new code
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('code', newCode);
      window.history.replaceState({}, '', newUrl.toString());
      
      toast({
        title: 'Code Sent',
        description: 'A new verification code has been sent to your email.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send verification code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      if (values.code === verificationCode) {
        // Verification successful - mark user as verified and redirect
        const user = auth.currentUser;
        if (user) {
          // Update user document to mark as verified
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            emailVerified: true,
            verifiedAt: new Date(),
          });
        }
        
        toast({
          title: 'Email Verified!',
          description: 'Your email has been successfully verified. Welcome to Vibez!',
        });
        
        // Redirect to main app
        router.push('/');
      } else {
        toast({
          title: 'Invalid Code',
          description: 'The verification code is incorrect. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Verification Failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Verify Your Email</CardTitle>
              <CardDescription>
                We've sent a 6-digit verification code to <strong>{userEmail}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="text-center text-2xl font-mono tracking-widest"
                        {...field}
                        onChange={(e) => {
                          // Only allow numbers and limit to 6 digits
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || form.watch('code').length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </Button>
              
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the code?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resendCode}
                  disabled={resendLoading}
                >
                  {resendLoading ? 'Sending...' : 'Resend Code'}
                </Button>
              </div>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  Back to Login
                </Link>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </>
  );
}