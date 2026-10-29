import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthButton from './AuthButton';
import AuthError from './AuthError';
import AuthField from './AuthField';
import PasswordField from './PasswordField';
import useAuthClock, { formatCountdown, secondsRemaining } from './useAuthClock';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function LoginForm({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  status,
  error,
  retryAt,
}) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [rememberMe, setRememberMe] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const now = useAuthClock();
  const retryIn = secondsRemaining(retryAt, now);
  const loading = status === 'authenticating';
  const success = status === 'success';
  const busy = loading || success;
  const emailValue = typeof email === 'string' ? email : '';

  function handleSubmit(event) {
    event.preventDefault();
    if (busy || retryIn > 0) return;
    const errors = {};
    if (!emailValue.trim()) errors.email = 'Enter your work email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim())) {
      errors.email = 'Enter a valid work email.';
    }
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
    else onSubmit({ rememberMe });
  }

  return (
    <div className="w-full">
      <header className="mb-8">
        <h1 className="m-0 text-[30px] leading-tight font-semibold tracking-[-0.02em] text-slate-900 sm:text-[32px]">
          Welcome back
        </h1>
        <p className="m-0 mt-2 text-[15px] leading-6 text-slate-600">
          Sign in to your RetailOps workspace.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-6"
        aria-label="Sign in to RetailOps"
      >
        <AuthError message={error?.message} className="mb-0" />

        <AuthField
          inputRef={emailRef}
          id="work-email"
          name="email"
          label="Work email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@company.com"
          value={emailValue}
          onChange={event => {
            onEmailChange(event.target.value);
            setFieldErrors(errors => ({ ...errors, email: undefined }));
          }}
          error={fieldErrors.email}
          disabled={busy}
          required
        />

        <PasswordField
          inputRef={passwordRef}
          id="login-password"
          name="password"
          label="Password"
          placeholder="Enter your password"
          value={typeof password === 'string' ? password : ''}
          onChange={event => {
            onPasswordChange(event.target.value);
            setFieldErrors(errors => ({ ...errors, password: undefined }));
          }}
          error={fieldErrors.password}
          disabled={busy}
          required
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={value => setRememberMe(value === true)}
              disabled={busy}
              className="border-slate-500 data-[state=checked]:border-[#1d4ed8] data-[state=checked]:bg-[#1d4ed8]"
            />
            <Label htmlFor="remember-me" className="text-sm font-normal text-slate-700">
              Remember me
            </Label>
          </div>

          <Link
            to="/forgot-password"
            state={{ email: emailValue }}
            className="rounded text-sm font-medium !text-[#1d4ed8] transition-colors hover:!text-[#1e40af] hover:underline focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-disabled={busy || undefined}
            onClick={event => {
              if (busy) event.preventDefault();
            }}
          >
            Forgot password?
          </Link>
        </div>

        <AuthButton
          loading={loading}
          loadingText="Signing in…"
          success={success}
          successText="Signed in"
          disabled={retryIn > 0}
        >
          {retryIn > 0 ? `Try again in ${formatCountdown(retryIn)}` : 'Continue'}
        </AuthButton>

        <span className="sr-only" role="status" aria-live="polite">
          {loading
            ? 'Signing in. Please wait.'
            : success
              ? 'Signed in. Opening your workspace.'
              : ''}
        </span>
      </form>
    </div>
  );
}
