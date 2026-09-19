import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useLoginFlow from '../hooks/useLoginFlow';
import AuthLayout from '../components/auth/AuthLayout';
import LoginForm from '../components/auth/LoginForm';
import OtpVerification from '../components/auth/OtpVerification';
import styles from '../components/auth/Auth.module.css';

export default function LoginPage() {
  const { isAuthenticated, user } = useAuth();
  const flow = useLoginFlow();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${flow.stage === 'otp' ? 'Verify your identity' : 'Sign in'} · RetailOps`;
    return () => { document.title = previousTitle; };
  }, [flow.stage]);

  // Keep an in-flight login mounted through its success state and setup-aware
  // navigation. Previously the outer route redirected to / as soon as user was
  // set, racing the password-reset / first-login destination.
  if (isAuthenticated && flow.status === 'idle' && flow.stage === 'login') {
    const needsSetup = user?.isFirstLogin || user?.needsPasswordReset || user?.forcePasswordReset;
    return <Navigate to={needsSetup ? '/setup-wizard' : '/'} replace />;
  }

  return (
    <AuthLayout>
      <div className={styles.journey}>
        {flow.stage === 'otp' && flow.challenge ? (
          <OtpVerification
            challenge={flow.challenge}
            otp={flow.otp}
            trustDevice={flow.trustDevice}
            status={flow.status}
            error={flow.error}
            notice={flow.notice}
            retryAt={flow.retryAt}
            onOtpChange={flow.setOtp}
            onTrustChange={flow.setTrustDevice}
            onVerify={flow.verifyOtp}
            onResend={flow.resendOtp}
            onBack={flow.backToLogin}
          />
        ) : (
          <LoginForm
            email={flow.email}
            password={flow.password}
            onEmailChange={flow.setEmail}
            onPasswordChange={flow.setPassword}
            onSubmit={flow.submitLogin}
            status={flow.status}
            error={flow.error}
            retryAt={flow.retryAt}
          />
        )}
      </div>
    </AuthLayout>
  );
}
