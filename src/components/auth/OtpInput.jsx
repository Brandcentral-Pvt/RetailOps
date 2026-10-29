import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const DIGIT_COUNT = 6;

export default function OtpInput({ value, onChange, disabled, error, success }) {
  const refs = useRef([]);
  const digits = Array.from({ length: DIGIT_COUNT }, (_, index) => value[index] || '');

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (error?.code === 'OTP_INVALID') {
      refs.current[0]?.focus();
      refs.current[0]?.select();
    } else if (error?.code === 'OTP_INCOMPLETE') {
      const empty = refs.current.find(input => input && !input.value);
      empty?.focus();
    }
  }, [error]);

  const focus = index => {
    refs.current[index]?.focus();
    refs.current[index]?.select();
  };

  function enter(index, text) {
    if (disabled || !/^\d{0,6}$/.test(text)) return;
    const next = [...digits];
    // Browser one-time-code autofill can send the entire code to one cell.
    const start = text.length === DIGIT_COUNT ? 0 : index;
    if (!text) next[index] = '';
    else
      text.split('').forEach((digit, offset) => {
        if (start + offset < DIGIT_COUNT) next[start + offset] = digit;
      });
    onChange(next);
    if (text) focus(Math.min(start + text.length, DIGIT_COUNT - 1));
  }

  function handleKeyDown(index, event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      focus(Math.max(0, Math.min(DIGIT_COUNT - 1, index + (event.key === 'ArrowLeft' ? -1 : 1))));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focus(event.key === 'Home' ? 0 : DIGIT_COUNT - 1);
    } else if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      onChange(next);
      focus(index - 1);
    }
  }

  const invalid = ['OTP_INVALID', 'OTP_INCOMPLETE', 'OTP_EXPIRED', 'OTP_ATTEMPTS'].includes(
    error?.code
  );

  return (
    <div
      className="grid grid-cols-6 gap-1.5 sm:gap-2"
      role="group"
      aria-labelledby="verification-code-label"
      aria-describedby={error ? 'otp-error' : 'otp-hint'}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={element => {
            refs.current[index] = element;
          }}
          className={cn(
            'h-12 w-full min-w-0 rounded-lg border border-slate-500 bg-white text-center text-xl font-semibold text-slate-900 caret-[#1d4ed8] shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none',
            'focus:border-[#1d4ed8] focus:ring-[3px] focus:ring-[#1d4ed8]/25',
            'disabled:cursor-default disabled:opacity-100',
            digit && 'border-slate-600 bg-slate-50',
            invalid && 'border-red-600 bg-red-50 focus:border-red-700 focus:ring-red-600/20',
            success && 'border-emerald-700 bg-emerald-50'
          )}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={DIGIT_COUNT}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoCapitalize="none"
          spellCheck={false}
          aria-label={`Digit ${index + 1} of 6`}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'otp-error' : undefined}
          value={digit}
          onChange={event => enter(index, event.target.value)}
          onKeyDown={event => handleKeyDown(index, event)}
          onFocus={event => event.target.select()}
          onPaste={event => {
            event.preventDefault();
            enter(index, event.clipboardData.getData('text').trim());
          }}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
