import { ArrowLeft, Check, Mail } from 'lucide-react';
import AuthButton from './AuthButton';
import AuthError from './AuthError';
import OtpInput from './OtpInput';
import useAuthClock, { formatCountdown, secondsRemaining } from './useAuthClock';
import { AUTH_MESSAGES } from '../../services/authRequest';
import styles from './Auth.module.css';

export default function OtpVerification({ challenge, otp, trustDevice, status, error, notice, retryAt, onOtpChange, onTrustChange, onVerify, onResend, onBack }) {
  const now = useAuthClock();
  const expiresIn = secondsRemaining(challenge.expiresAt, now);
  const resendIn = secondsRemaining(challenge.resendAt, now);
  const retryIn = secondsRemaining(retryAt, now);
  const verifying = status === 'verifying';
  const resending = status === 'resending';
  const success = status === 'success';
  const busy = verifying || resending || success;
  const sessionExpired = error?.code === 'SESSION_EXPIRED';
  const codeBlocked = ['OTP_EXPIRED', 'OTP_ATTEMPTS', 'OTP_DAILY_LIMIT'].includes(error?.code);
  const displayError = error || (!expiresIn && !busy ? { code: 'OTP_EXPIRED', message: AUTH_MESSAGES.OTP_EXPIRED } : null);

  return (
    <div className={styles.step}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Verify your identity</h1>
        <p className={styles.headerSubtitle}>Enter the verification code sent to your email.</p>
        <p className={styles.destination}>
          <Mail size={14} strokeWidth={1.7} aria-hidden="true" />
          <span>{challenge.destination}</span>
        </p>
      </header>
      <form
        className={styles.verificationForm}
        aria-label="Verify your identity"
        noValidate
        onSubmit={event => { event.preventDefault(); onVerify(); }}
      >
        <div className={styles.otpMeta}>
          <span className={styles.label} id="verification-code-label">Verification code</span>
          <span className={styles.expiryTime} aria-live="off">
            {success ? 'Verified' : expiresIn > 0 ? `Expires in ${formatCountdown(expiresIn)}` : 'Code expired'}
          </span>
        </div>
        <OtpInput
          key={challenge.expiresAt}
          value={otp}
          onChange={onOtpChange}
          disabled={busy || sessionExpired || !expiresIn || codeBlocked}
          error={displayError}
          success={success}
        />
        <p id="otp-hint" className={styles.srOnly}>Enter six digits. You can also paste the complete verification code.</p>
        <AuthError id="otp-error" message={displayError?.message} />
        <label className={styles.trustDevice}>
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={event => onTrustChange(event.target.checked)}
            disabled={busy || sessionExpired}
          />
          <span>
            <span className={styles.trustLabel}>Trust this device for 12 hours</span>
            <span className={styles.trustHint}>Only on a device you own. Not a shared computer.</span>
          </span>
        </label>
        <AuthButton
          loading={verifying}
          loadingText="Verifying…"
          success={success}
          successText="Identity verified"
          disabled={resending || sessionExpired || !expiresIn || codeBlocked || retryIn > 0}
        >
          Verify and continue
        </AuthButton>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {verifying ? 'Verifying your identity. Please wait.' : success ? 'Identity verified. Opening your workspace.' : ''}
        </span>
      </form>
      <div className={styles.resendSection}>
        <p>Didn't receive the code?</p>
        <button
          type="button"
          className={styles.resendButton}
          onClick={onResend}
          disabled={busy || resendIn > 0 || sessionExpired || error?.code === 'OTP_DAILY_LIMIT'}
          aria-busy={resending || undefined}
        >
          {resending ? 'Sending a new code…' : resendIn > 0 ? `Resend code in ${formatCountdown(resendIn)}` : 'Resend code'}
        </button>
        <p className={styles.resendNotice} role="status" aria-live="polite">
          {notice && <><Check size={13} aria-hidden="true" />{notice}</>}
        </p>
      </div>
      <button type="button" className={styles.backButton} onClick={onBack} disabled={success}>
        <ArrowLeft size={15} strokeWidth={1.7} aria-hidden="true" />
        Back to sign in
      </button>
    </div>
  );
}
