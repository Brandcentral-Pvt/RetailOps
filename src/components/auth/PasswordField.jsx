import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import AuthField from './AuthField';

export default function PasswordField({
  inputRef,
  error,
  disabled,
  id = 'login-password',
  label = 'Password',
  autoComplete = 'current-password',
  placeholder = 'Enter your password',
  hint,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const VisibilityIcon = visible ? EyeOff : Eye;

  return (
    <AuthField
      {...props}
      inputRef={inputRef}
      id={id}
      label={label}
      error={error}
      hint={hint}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      placeholder={placeholder}
      disabled={disabled}
      required
      trailing={
        <button
          className="flex size-10 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#1d4ed8] focus-visible:ring-offset-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          type="button"
          onClick={() => setVisible(value => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={disabled}
        >
          <VisibilityIcon size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
      }
    />
  );
}
