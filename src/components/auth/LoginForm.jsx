import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import AuthButton from './AuthButton';
import AuthError from './AuthError';
import PasswordField from './PasswordField';
import useAuthClock, { formatCountdown, secondsRemaining } from './useAuthClock';
import styles from './Auth.module.css';

export default function LoginForm({ email, password, onEmailChange, onPasswordChange, onSubmit, status, error, retryAt }) {
  const [fieldErrors, setFieldErrors] = useState({});
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const now = useAuthClock();
  const retryIn = secondsRemaining(retryAt, now);
  const loading = status === 'authenticating';
  const success = status === 'success';
  const busy = loading || success;

  function handleSubmit(event) {
    event.preventDefault();
    if (busy || retryIn > 0) return;
    const errors = {};
    if (!email.trim()) errors.email = 'Enter your work email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid work email.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
    else onSubmit();
  }

  return (
    <div className={styles.step}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Welcome back</h1>
        <p className={styles.headerSubtitle}>Sign in to your RetailOps workspace.</p>
      </header>
      <form onSubmit={handleSubmit} noValidate className={styles.loginForm} aria-label="Sign in to RetailOps">
        <AuthError message={error?.message} />
        <div className={styles.field}>
          <label className={styles.label} htmlFor="work-email">Work email</label>
          <div className={`${styles.inputWrap} ${fieldErrors.email ? styles.inputWrapInvalid : ''}`}>
            <Mail className={styles.inputIcon} size={18} strokeWidth={1.6} aria-hidden="true" />
            <input
              ref={emailRef}
              className={styles.textInput}
              id="work-email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="name@company.com"
              value={email}
              onChange={event => {
                onEmailChange(event.target.value);
                setFieldErrors(errors => ({ ...errors, email: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              readOnly={busy}
              required
            />
          </div>
          {fieldErrors.email && <p className={styles.fieldError} id="email-error">{fieldErrors.email}</p>}
        </div>
        <PasswordField
          inputRef={passwordRef}
          value={password}
          onChange={event => {
            onPasswordChange(event.target.value);
            setFieldErrors(errors => ({ ...errors, password: undefined }));
          }}
          error={fieldErrors.password}
          disabled={busy}
        />
        <div className={styles.forgotPassword}>
          <Link
            to="/forgot-password"
            state={{ email }}
            className={styles.authLink}
            aria-disabled={busy || undefined}
            onClick={event => { if (busy) event.preventDefault(); }}
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
        <span className={styles.srOnly} role="status" aria-live="polite">
          {loading ? 'Signing in. Please wait.' : success ? 'Signed in. Opening your workspace.' : ''}
        </span>
      </form>
      <p className={styles.accessHelp}>
        Need access to RetailOps? <span>Contact your administrator.</span>
      </p>
    </div>
  );
}
