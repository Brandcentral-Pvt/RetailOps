import { ArrowLeft, Check, Mail } from 'lucide-react';
import AuthButton from './AuthButton';
import AuthError from './AuthError';
import OtpInput from './OtpInput';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import useAuthClock, { formatCountdown, secondsRemaining } from './useAuthClock';
import { AUTH_MESSAGES } from '../../services/authRequest';

export default function OtpVerification({
  challenge,
  otp,
  trustDevice,
  status,
  error,
  notice,
  retryAt,
  onOtpChange,
  onTrustChange,
  onVerify,
  onResend,
  onBack,
}) {
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
  const displayError =
    error || (!expiresIn && !busy ? { code: 'OTP_EXPIRED', message: AUTH_MESSAGES.OTP_EXPIRED } : null);

  return (
    <div className="w-full">
      <header className="mb-7">
        <h1 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.02em] text-slate-900 sm:text-[30px]">
          Verify your identity
        </h1>
        <p className="m-0 mt-2 text-sm leading-6 text-slate-600">
          Enter the verification code sent to your email.
        </p>
        <p className="m-0 mt-[12px] inline-flex items-center gap-2 text-[13px] leading-5 font-medium text-slate-700">
          <Mail className="size-3.5 text-slate-600" strokeWidth={1.7} aria-hidden="true" />
          <span className="break-all">{challenge.destination}</span>
        </p>
      </header>

      <form
        className="grid gap-[16px]"
        aria-label="Verify your identity"
        noValidate
        onSubmit={event => {
          event.preventDefault();
          onVerify();
        }}
      >
        <div className="grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span
              id="verification-code-label"
              className="text-[13px] leading-5 font-semibold text-slate-700"
            >
              Verification code
            </span>
            <span className="text-[11px] leading-5 text-slate-600 tabular-nums" aria-live="off">
              {success
                ? 'Verified'
                : expiresIn > 0
                  ? `Expires in ${formatCountdown(expiresIn)}`
                  : 'Code expired'}
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
          <p id="otp-hint" className="sr-only">
            Enter six digits. You can also paste the complete verification code.
          </p>
          <AuthError id="otp-error" message={displayError?.message} className="mt-1 mb-0" />
        </div>

        <div className="mt-1 flex items-start gap-3">
          <Checkbox
            id="trust-device"
            className="mt-0.5 border-slate-500 data-[state=checked]:border-[#1d4ed8] data-[state=checked]:bg-[#1d4ed8]"
            checked={trustDevice}
            onCheckedChange={value => onTrustChange(value === true)}
            disabled={busy || sessionExpired}
          />
          <div className="grid gap-0.5">
            <Label htmlFor="trust-device" className="text-xs leading-5 font-medium text-slate-700">
              Trust this device for 12 hours
            </Label>
            <span className="text-[11px] leading-[18px] text-slate-600">
              Only on a device you own. Not a shared computer.
            </span>
          </div>
        </div>

        <AuthButton
          loading={verifying}
          loadingText="Verifying…"
          success={success}
          successText="Identity verified"
          disabled={resending || sessionExpired || !expiresIn || codeBlocked || retryIn > 0}
        >
          Verify and continue
        </AuthButton>

        <span className="sr-only" role="status" aria-live="polite">
          {verifying
            ? 'Verifying your identity. Please wait.'
            : success
              ? 'Identity verified. Opening your workspace.'
              : ''}
        </span>
      </form>

      <div className="mt-6 text-center">
        <p className="m-0 text-xs leading-5 text-slate-600">Didn&apos;t receive the code?</p>
        <button
          type="button"
          className="mt-1 rounded px-2 py-1 text-xs leading-5 font-medium text-[#1d4ed8] tabular-nums underline-offset-4 transition-colors hover:text-[#1e40af] hover:underline focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default disabled:text-slate-600 disabled:no-underline"
          onClick={onResend}
          disabled={busy || resendIn > 0 || sessionExpired || error?.code === 'OTP_DAILY_LIMIT'}
          aria-busy={resending || undefined}
        >
          {resending
            ? 'Sending a new code…'
            : resendIn > 0
              ? `Resend code in ${formatCountdown(resendIn)}`
              : 'Resend code'}
        </button>
        <p
          className="m-0 mt-1 flex min-h-4 items-center justify-center gap-1 text-[11px] leading-[18px] text-emerald-800"
          role="status"
          aria-live="polite"
        >
          {notice && (
            <>
              <Check className="size-3" aria-hidden="true" />
              {notice}
            </>
          )}
        </p>
      </div>

      <button
        type="button"
        className="mx-auto mt-[12px] flex items-center gap-1.5 rounded px-2 py-1 text-xs leading-5 font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default disabled:text-slate-500"
        onClick={onBack}
        disabled={success}
      >
        <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
        Back to sign in
      </button>
    </div>
  );
}
