import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import AuthButton from '../components/auth/AuthButton';
import AuthError from '../components/auth/AuthError';
import PasswordField from '../components/auth/PasswordField';
import { cn } from '@/lib/utils';
import { authApi } from '../services/api';

function getPasswordStrength(password) {
  if (!password) return { label: '', percent: 0, bar: 'bg-slate-200', text: 'text-slate-500' };
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  if (score <= 2) return { label: 'Weak', percent: 25, bar: 'bg-red-600', text: 'text-red-700' };
  if (score <= 3) return { label: 'Fair', percent: 50, bar: 'bg-amber-500', text: 'text-amber-800' };
  if (score <= 4) return { label: 'Good', percent: 75, bar: 'bg-blue-600', text: 'text-blue-700' };
  return { label: 'Strong', percent: 100, bar: 'bg-emerald-700', text: 'text-emerald-700' };
}

const tones = {
  success: 'bg-emerald-50 text-emerald-700',
  error: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
};

function StatusPanel({ tone = 'info', icon: Icon, title, children, action }) {
  return (
    <div className="w-full text-center">
      <div className={cn('mx-auto mb-4 flex size-12 items-center justify-center rounded-xl', tones[tone])}>
        <Icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <h1 className="m-0 text-2xl font-semibold tracking-[-0.01em] text-slate-900">{title}</h1>
      <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>
      {action ? <div className="mx-auto mt-6 max-w-[280px]">{action}</div> : null}
    </div>
  );
}

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const strength = getPasswordStrength(password);
  const requirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(password), text: 'One number' },
  ];
  const mismatch = Boolean(confirmPassword) && password !== confirmPassword;
  const canSubmit = password.length >= 8 && password === confirmPassword;

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('No reset token provided');
        setLoading(false);
        return;
      }
      try {
        const res = await authApi.validateResetToken(token);
        if (res.valid) {
          setValid(true);
          setUserName(res.firstName || '');
        } else {
          setError(res.message || 'Invalid or expired reset link');
        }
      } catch (e) {
        setError(e.message || 'Failed to validate reset link');
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, [token]);

  const handleSubmit = async event => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      setResetSuccess(true);
    } catch (e) {
      setError(e.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout>
        <div
          className="flex min-h-56 w-full flex-col items-center justify-center gap-3 text-center"
          role="status"
          aria-live="polite"
        >
          <span className="icon-[svg-spinners--eclipse] text-2xl text-[#1976d2]" aria-hidden="true" />
          <p className="m-0 text-sm text-slate-600">Validating reset link…</p>
        </div>
      </AuthLayout>
    );
  }

  if (resetSuccess) {
    return (
      <AuthLayout>
        <StatusPanel
          tone="success"
          icon={CheckCircle2}
          title="Password Reset!"
          action={
            <AuthButton onClick={() => navigate('/login')}>Sign In</AuthButton>
          }
        >
          <p className="m-0">
            Your password has been updated successfully. You can now sign in with your new
            password.
          </p>
        </StatusPanel>
      </AuthLayout>
    );
  }

  if (!valid) {
    return (
      <AuthLayout>
        <StatusPanel
          tone="error"
          icon={CircleAlert}
          title="Invalid Link"
          action={
            <AuthButton onClick={() => navigate('/forgot-password')}>Request New Link</AuthButton>
          }
        >
          <p className="m-0">{error || 'This reset link is invalid or has expired.'}</p>
        </StatusPanel>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full">
        <header className="mb-7">
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-slate-900 sm:text-[30px]">
            Reset Password
          </h1>
          <p className="m-0 mt-2 text-sm leading-6 text-slate-600">
            {userName ? `Hi ${userName}, ` : ''}Create a new strong password for your account
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="grid gap-[20px]">
          <AuthError message={error} className="mb-0" />

          <div className="grid gap-2">
            <PasswordField
              id="new-password"
              label="New password"
              autoComplete="new-password"
              placeholder="New password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
            {password ? (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between text-[11px] leading-4 text-slate-600">
                  <span>
                    Strength:{' '}
                    <span className={cn('font-semibold', strength.text)}>{strength.label}</span>
                  </span>
                </div>
                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-label="Password strength"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={strength.percent}
                >
                  <div
                    className={cn('h-full rounded-full transition-[width]', strength.bar)}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            error={mismatch ? 'Passwords do not match.' : ''}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="m-0 mb-1.5 text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
              Password Requirements
            </p>
            <ul className="m-0 grid list-none grid-cols-1 gap-1 p-0 sm:grid-cols-2">
              {requirements.map(requirement => (
                <li
                  key={requirement.text}
                  className={cn(
                    'flex items-center gap-1.5 text-[11px] leading-5',
                    requirement.met ? 'text-emerald-700' : 'text-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      requirement.met ? 'bg-emerald-600' : 'bg-slate-400'
                    )}
                    aria-hidden="true"
                  />
                  {requirement.text}
                </li>
              ))}
            </ul>
          </div>

          <AuthButton loading={submitting} loadingText="Resetting password…" disabled={!canSubmit}>
            Reset Password
          </AuthButton>
        </form>
      </div>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
