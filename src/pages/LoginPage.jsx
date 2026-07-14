import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { MailOutlined, LockOutlined, SafetyCertificateOutlined, ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import AuthLayout from '../components/auth/AuthLayout';
import styles from '../components/auth/Auth.module.css';

const { Title, Text } = Typography;

const OtpStep = ({ tempToken, destination, expiresIn, onBack }) => {
  const { completeLogin } = useAuth();
  const navigate = useNavigate();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(expiresIn || 300);
  const [trustDevice, setTrustDevice] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRefs = useRef([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);
  useEffect(() => { if (timeLeft <= 0) return; const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000); return () => clearInterval(t); }, [timeLeft]);
  useEffect(() => { if (resendCooldown <= 0) return; const t = setInterval(() => setResendCooldown(p => Math.max(0, p - 1)), 1000); return () => clearInterval(t); }, [resendCooldown]);

  const handleChange = (index, val) => {
    if (val && !/^\d$/.test(val)) return;
    const next = [...otp]; next[index] = val; setOtp(next);
    if (val && index < 5) inputRefs.current[index + 1]?.focus();
    if (next.every(d => d)) verify(next.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (p.length === 6) { setOtp(p.split('')); verify(p); }
  };

  const verify = async (code) => {
    setLoading(true); setError('');
    try {
      const res = await authApi.verifyOtp(tempToken, code, trustDevice);
      if (res.success) {
        await completeLogin(res);
        if (res.requiresSetup || res.needsPasswordReset) {
          navigate('/setup-wizard');
          return;
        }
        navigate('/');
      }
    } catch (e) {
      setError(e.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      if (e.message?.includes('expired')) setTimeout(onBack, 2000);
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true); setError('');
    try {
      const res = await authApi.resendOtp(tempToken);
      setTimeLeft(res.expiresIn);
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (e) { setError(e.message || 'Failed to resend'); }
    finally { setResending(false); }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className={styles.textCenter}>
      <div className={styles.statusIconInfo}>
        <SafetyCertificateOutlined style={{ fontSize: 22, color: 'var(--text-primary)' }} />
      </div>
      <Title level={4} className={styles.statusTitle}>Verify Your Identity</Title>
      <Text className={styles.statusBody} style={{ marginTop: 6 }}>
        We sent a 6-digit code to <strong>{destination}</strong>
      </Text>

      {error && <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 16, borderRadius: 'var(--radius-md)' }} />}

      <div className={styles.otpContainer} role="group" aria-label="One-time password input">
        {otp.map((d, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            autoComplete="one-time-code"
            aria-label={`OTP digit ${i + 1}`}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            disabled={loading}
            className={d ? styles.otpInputFilled : styles.otpInput}
          />
        ))}
      </div>

      {timeLeft > 0 ? (
        <Text className={timeLeft < 60 ? styles.otpTimerUrgent : styles.otpTimer}>
          Expires in {fmt(timeLeft)}
        </Text>
      ) : (
        <Alert type="warning" message="Code expired. Please request a new one." showIcon style={{ marginBottom: 16, borderRadius: 'var(--radius-md)' }} />
      )}

      <div style={{ marginBottom: 16 }}>
        <Checkbox checked={trustDevice} onChange={e => setTrustDevice(e.target.checked)}>
          <span style={{ fontSize: 'var(--font-size-sm)' }}>Trust this device for 12 hours</span>
        </Checkbox>
      </div>

      <Button type="primary" block size="large" loading={loading} disabled={otp.some(d => !d)}
        onClick={() => verify(otp.join(''))} className={styles.authBtn}>
        Verify & Sign In
      </Button>

      <div className={styles.otpActions}>
        <Button type="link" size="small" icon={<ReloadOutlined />} onClick={handleResend} loading={resending} disabled={resendCooldown > 0} style={{ color: 'var(--text-primary)' }}>
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
        </Button>
        <Button type="link" size="small" icon={<ArrowLeftOutlined />} onClick={onBack}>Back to Login</Button>
      </div>
    </div>
  );
};

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('login');
  const [otpData, setOtpData] = useState(null);

  const handleSubmit = async (values) => {
    setLoading(true); setError('');
    try {
      const result = await login(values.email.trim(), values.password);
      if (!result.success) throw new Error(result.error || 'Login failed');
      if (result.requiresOtp) {
        setOtpData({ tempToken: result.tempToken, destination: result.destination, expiresIn: result.expiresIn });
        setStep('otp');
        return;
      }
      if (result.needsPasswordReset || result.forcePasswordReset) {
        navigate('/setup-wizard');
        return;
      }
      if (result.requiresSetup) {
        navigate('/setup-wizard');
        return;
      }
    } catch (err) {
      let msg = err.message || 'An unexpected error occurred';
      if (msg.includes('fetch') || msg.includes('network')) msg = 'Unable to connect to the server.';
      setError(msg);
    } finally { setLoading(false); }
  };

  if (step === 'otp' && otpData) {
    return (
      <AuthLayout>
        <OtpStep {...otpData} onBack={() => { setStep('login'); setOtpData(null); setError(''); }} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className={styles.header}>
        <Title level={3} className={styles.headerTitle}>Welcome back</Title>
        <Text className={styles.headerSubtitle}>Sign in to your account</Text>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div key="err" style={{ overflow: 'hidden' }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
            <div className={styles.errorBanner}>
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="on" size="large" requiredMark={false}>
        <Form.Item name="email" rules={[{ required: true, message: 'Email required' }, { type: 'email', message: 'Invalid email' }]}>
          <Input prefix={<MailOutlined style={{ color: 'var(--text-secondary)' }} />} placeholder="Email address" autoFocus autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Password required' }, { min: 6, message: 'Minimum 6 characters' }]}>
          <Input.Password prefix={<LockOutlined style={{ color: 'var(--text-secondary)' }} />} placeholder="Password" autoComplete="current-password" />
        </Form.Item>
        <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
          <Link to="/forgot-password" className={styles.authLink}>Forgot password?</Link>
        </div>
        <Form.Item style={{ marginBottom: 0 }}>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" className={styles.authBtn}>
              {loading ? 'Verifying...' : 'Continue'}
            </Button>
          </motion.div>
        </Form.Item>
      </Form>

      <div className={styles.mt20}>
        <Text style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
          Don't have an account? <Link to="/register" className={styles.authLinkPrimary}>Sign Up</Link>
        </Text>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
