// Client-side email service that calls the API route

export async function sendEmail(message: { to: string, subject: string, html: string, text?: string }) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error('Failed to send email');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// In-memory store for verification codes (use Redis or similar in production)
const verificationCodes = new Map<string, { code: string; expires: number }>();

export async function sendVerificationEmail(to: string, code: string) {
  try {
    // Store the verification code with 10-minute expiry
    verificationCodes.set(to, {
      code,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    const mailOptions = {
      to,
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
      text: `Welcome to Vibez! Your verification code is: ${code}\n\nThis code will expire in 10 minutes.`
    };

    await sendEmail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  const storedData = verificationCodes.get(email);
  
  if (!storedData) {
    return false; // No verification code found
  }

  if (Date.now() > storedData.expires) {
    verificationCodes.delete(email); // Clean up expired code
    return false; // Code has expired
  }

  if (storedData.code === code) {
    verificationCodes.delete(email); // Clean up used code
    return true;
  }

  return false;
}

// Generate a random 6-digit verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}