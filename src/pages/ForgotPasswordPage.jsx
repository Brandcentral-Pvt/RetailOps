import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import AuthButton from '../components/auth/AuthButton';
import AuthError from '../components/auth/AuthError';
import AuthField from '../components/auth/AuthField';
import { authApi } from '../services/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async event => {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      setFieldError('Enter your work email.');
      return;
    }
    if (!EMAIL_PATTERN.test(value)) {
      setFieldError('Enter a valid work email.');
      return;
    }

    setFieldError('');
    setLoading(true);
    setError('');
    try {
      const res = await authApi.forgotPassword(value);
      if (res.success) {
        setSent(true);
      } else {
        setError(res.message || 'Failed to send reset link');
      }
    } catch (e) {
      setError(e.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="w-full text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="size-6" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.01em] text-slate-900">
            Check Your Email
          </h1>
          <p className="m-0 mt-2 text-sm leading-6 text-slate-600">
            We've sent a password reset link to your email address. Please check your inbox and
            click the link to reset your password.
          </p>
          <p className="m-0 mt-3 text-xs leading-5 text-slate-500">
            Didn't receive the email? Check your spam folder or try again.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-6 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs leading-5 font-medium text-[#1467b9] underline-offset-4 transition-colors hover:text-[#125396] hover:underline focus-visible:ring-2 focus-visible:ring-[#1976d2] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Back to Forgot Password
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full">
        <header className="mb-7">
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-slate-900 sm:text-[30px]">
            Forgot Password?
          </h1>
          <p className="m-0 mt-2 text-sm leading-6 text-slate-600">
            Enter your email and we'll send you a reset link
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="grid gap-[20px]">
          <AuthError message={error} className="mb-0" />

          <AuthField
            id="forgot-email"
            name="email"
            label="Work email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={event => {
              setEmail(event.target.value);
              setFieldError('');
            }}
            error={fieldError}
            required
          />

          <AuthButton loading={loading} loadingText="Sending link…">
            Send Reset Link
          </AuthButton>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs leading-5 font-medium text-slate-600 underline-offset-4 transition-colors hover:text-[#145fa8] hover:underline focus-visible:ring-2 focus-visible:ring-[#1976d2] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
