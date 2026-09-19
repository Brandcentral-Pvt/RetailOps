import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import styles from './Auth.module.css';

export default function PasswordField({ inputRef, error, disabled, ...props }) {
  const [visible, setVisible] = useState(false);
  const VisibilityIcon = visible ? EyeOff : Eye;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="login-password">Password</label>
      <div className={`${styles.inputWrap} ${error ? styles.inputWrapInvalid : ''}`}>
        <LockKeyhole className={styles.inputIcon} size={18} strokeWidth={1.6} aria-hidden="true" />
        <input
          {...props}
          ref={inputRef}
          className={styles.textInput}
          id="login-password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          readOnly={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'password-error' : undefined}
        />
        <button
          className={styles.visibilityToggle}
          type="button"
          onClick={() => setVisible(value => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={disabled}
        >
          <VisibilityIcon size={18} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>
      {error && <p className={styles.fieldError} id="password-error">{error}</p>}
    </div>
  );
}
