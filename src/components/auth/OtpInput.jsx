import { useEffect, useRef } from 'react';
import styles from './Auth.module.css';

const DIGIT_COUNT = 6;

export default function OtpInput({ value, onChange, disabled, error, success }) {
  const refs = useRef([]);
  const digits = Array.from({ length: DIGIT_COUNT }, (_, index) => value[index] || '');

  useEffect(() => { refs.current[0]?.focus(); }, []);
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
    else text.split('').forEach((digit, offset) => {
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

  const invalid = ['OTP_INVALID', 'OTP_INCOMPLETE', 'OTP_EXPIRED', 'OTP_ATTEMPTS'].includes(error?.code);

  return (
    <div
      className={styles.otpContainer}
      role="group"
      aria-labelledby="verification-code-label"
      aria-describedby={error ? 'otp-error' : 'otp-hint'}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={element => { refs.current[index] = element; }}
          className={`${styles.otpInput} ${digit ? styles.otpInputFilled : ''} ${invalid ? styles.otpInputInvalid : ''} ${success ? styles.otpInputSuccess : ''}`}
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
