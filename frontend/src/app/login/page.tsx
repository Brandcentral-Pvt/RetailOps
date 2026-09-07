'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock01, Mail01, ShieldTick } from '@untitled-ui/icons-react';
import { useLogin, useRequestOtp, useVerifyOtp } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { User } from '@/lib/api';

interface OtpResponse {
  success: boolean;
  data: {
    tempToken: string;
  };
}

interface VerifyOtpResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

type LoginStep = 'credentials' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const login = useLogin();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tempToken, setTempToken] = useState('');

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await requestOtp.mutateAsync({ email, password });
      const data = response.data as OtpResponse;
      if (data.success && data.data.tempToken) {
        setTempToken(data.data.tempToken);
        setStep('otp');
      } else {
        await handleDirectLogin();
      }
    } catch {
      await handleDirectLogin();
    }
  }

  async function handleDirectLogin() {
    try {
      await login.mutateAsync({ email, password });
      router.replace('/');
    } catch {
      // Error handled by mutation
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await verifyOtp.mutateAsync({ email, otp, tempToken });
      const data = response.data as VerifyOtpResponse;
      const payload = data.data;
      localStorage.setItem('accessToken', payload.accessToken);
      localStorage.setItem('refreshToken', payload.refreshToken);
      setAuth(payload.user, payload.accessToken, payload.refreshToken);
      router.replace('/');
    } catch {
      // Error handled by mutation
    }
  }

  async function handleResendOtp() {
    try {
      await requestOtp.mutateAsync({ email, password });
    } catch {
      // Error handled by mutation
    }
  }

  if (step === 'credentials') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="text-lg font-bold">B</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">BrandCentral</span>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-7">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
              <p className="mt-2 text-sm text-muted-foreground">Sign in to your RetailOps workspace.</p>
            </div>
            <form className="space-y-5" onSubmit={handleCredentialsSubmit}>
              <label className="block text-sm font-medium text-foreground">
                Work email
                <span className="relative mt-2 block">
                  <Mail01 width={18} height={18} className="pointer-events-none absolute left-3 top-3 text-muted-foreground" />
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                    placeholder="you@company.com"
                  />
                </span>
              </label>
              <label className="block text-sm font-medium text-foreground">
                Password
                <span className="relative mt-2 block">
                  <Lock01 width={18} height={18} className="pointer-events-none absolute left-3 top-3 text-muted-foreground" />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-11 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff width={18} height={18} /> : <Eye width={18} height={18} />}
                  </button>
                </span>
              </label>
              {(login.isError || requestOtp.isError) && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  Unable to sign in. Check your credentials and try again.
                </p>
              )}
              <button
                disabled={login.isPending || requestOtp.isPending}
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {login.isPending || requestOtp.isPending ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight width={17} height={17} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold">B</span>
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">BrandCentral</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center justify-center gap-2">
              <ShieldTick width={20} height={20} className="text-primary" />
              Two-Factor Authentication
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the 6-digit code sent to <strong className="text-foreground">{email}</strong>
            </p>
          </div>
          <form className="space-y-5" onSubmit={handleOtpSubmit}>
            <label className="block text-sm font-medium text-foreground">
              Verification Code
              <div className="relative mt-2">
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-background pl-4 pr-4 text-center text-2xl tracking-widest font-mono outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="000000"
                />
              </div>
            </label>
            {(verifyOtp.isError) && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Invalid code. Please try again or request a new one.
              </p>
            )}
            <button
              disabled={verifyOtp.isPending}
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifyOtp.isPending ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify
                  <ArrowRight width={17} height={17} />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={requestOtp.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {requestOtp.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Resending...
                </>
              ) : (
                'Resend code'
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep('credentials')}
              className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowRight width={14} height={14} className="-rotate-180" />
              Back to login
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}