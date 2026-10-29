import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Contact, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';
import AuthButton from '../components/auth/AuthButton';
import AuthError from '../components/auth/AuthError';
import AuthField from '../components/auth/AuthField';
import PasswordField from '../components/auth/PasswordField';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  const update = field => event => {
    setValues(previous => ({ ...previous, [field]: event.target.value }));
    setFieldErrors(previous => ({ ...previous, [field]: undefined }));
    setError('');
  };

  const onFinish = async event => {
    event.preventDefault();
    const errors = {};
    if (!values.name.trim()) errors.name = 'Enter your full name.';
    if (!values.email.trim()) errors.email = 'Enter your work email.';
    else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid work email.';
    if (!values.password) errors.password = 'Enter a password.';
    else if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
    if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setError('');
    try {
      const result = await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Registration failed. Access denied.');
      }
    } catch {
      setError('An unexpected error occurred during account creation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full">
        <header className="mb-7">
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-slate-900 sm:text-[30px]">
            Create Account
          </h1>
          <p className="m-0 mt-2 text-sm leading-6 text-slate-600">
            Enter your details to get started
          </p>
        </header>

        <form onSubmit={onFinish} noValidate className="grid gap-[20px]">
          <AuthError message={error} className="mb-0" />

          <AuthField
            id="register-name"
            name="name"
            label="Full name"
            icon={Contact}
            placeholder="Full name"
            autoComplete="name"
            value={values.name}
            onChange={update('name')}
            error={fieldErrors.name}
            required
          />

          <AuthField
            id="register-email"
            name="email"
            label="Work email"
            type="email"
            icon={Mail}
            placeholder="Email address"
            autoComplete="email"
            value={values.email}
            onChange={update('email')}
            error={fieldErrors.email}
            required
          />

          <PasswordField
            id="register-password"
            label="Password"
            autoComplete="new-password"
            placeholder="Password"
            value={values.password}
            onChange={update('password')}
            error={fieldErrors.password}
          />

          <PasswordField
            id="register-confirm-password"
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={values.confirmPassword}
            onChange={update('confirmPassword')}
            error={fieldErrors.confirmPassword}
          />

          <AuthButton loading={loading} loadingText="Creating account…">
            Create Account
          </AuthButton>
        </form>

        <p className="m-0 mt-6 text-center text-xs leading-5 text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="rounded font-semibold text-[#145fa8] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[#1976d2] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Sign In
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
