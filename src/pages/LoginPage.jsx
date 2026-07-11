import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { MailOutlined, LockOutlined, SafetyCertificateOutlined, ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import AuthLayout from '../components/auth/AuthLayout';

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
          setTimeout(() => navigate('/setup-wizard'), 100);
          return;
        }
        setTimeout(() => navigate('/'), 100);
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
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0f5ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <SafetyCertificateOutlined style={{ fontSize: 22, color: '#18181b' }} />
      </div>
      <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Verify Your Identity</Title>
      <Text style={{ fontSize: 13, color: '#71717a', display: 'block', marginTop: 6 }}>
        We sent a 6-digit code to <strong>{destination}</strong>
      </Text>

      {error && <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 16, borderRadius: 8 }} />}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
        {otp.map((d, i) => (
          <input key={i} ref={el => inputRefs.current[i] = el} type="text" inputMode="numeric" maxLength={1}
            value={d} onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined} disabled={loading}
            style={{ width: 44, height: 52, fontSize: 22, fontWeight: 600, textAlign: 'center', border: `2px solid ${d ? '#18181b' : '#e4e4e7'}`, borderRadius: 8, outline: 'none', fontFamily: 'monospace', background: d ? '#f4f4f5' : '#fff', transition: 'all 0.15s' }} />
        ))}
      </div>

      {timeLeft > 0 ? (
        <Text style={{ display: 'block', textAlign: 'center', fontSize: 13, color: timeLeft < 60 ? '#C62828' : '#71717a', marginBottom: 16 }}>
          Expires in {fmt(timeLeft)}
        </Text>
      ) : (
        <Alert type="warning" message="Code expired. Please request a new one." showIcon style={{ marginBottom: 16, borderRadius: 8 }} />
      )}

      <div style={{ marginBottom: 16 }}>
        <Checkbox checked={trustDevice} onChange={e => setTrustDevice(e.target.checked)}>
          <span style={{ fontSize: 13 }}>Trust this device for 12 hours</span>
        </Checkbox>
      </div>

      <Button type="primary" block size="large" loading={loading} disabled={otp.some(d => !d)}
        onClick={() => verify(otp.join(''))} style={{ height: 44, fontWeight: 600, borderRadius: 10, background: '#18181b', borderColor: '#18181b' }}>
        Verify & Sign In
      </Button>

      <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16 }}>
        <Button type="link" size="small" icon={<ReloadOutlined />} onClick={handleResend} loading={resending} disabled={resendCooldown > 0} style={{ fontSize: 12, color: '#18181b' }}>
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
        </Button>
        <Button type="link" size="small" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ fontSize: 12 }}>Back to Login</Button>
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
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#18181b' }}>Welcome back</Title>
        <Text style={{ fontSize: 13, color: '#71717a', display: 'block', marginTop: 4 }}>Sign in to your account</Text>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div key="err" style={{ overflow: 'hidden' }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off" size="large" requiredMark={false}>
        <Form.Item name="email" rules={[{ required: true, message: 'Email required' }, { type: 'email', message: 'Invalid email' }]}>
          <Input prefix={<MailOutlined style={{ color: '#71717a' }} />} placeholder="Email address" autoFocus />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Password required' }]}>
          <Input.Password prefix={<LockOutlined style={{ color: '#71717a' }} />} placeholder="Password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 44, fontWeight: 600, fontSize: 14, borderRadius: 10, background: '#18181b', borderColor: '#18181b' }}>
              {loading ? 'Verifying...' : 'Continue'}
            </Button>
          </motion.div>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Text style={{ fontSize: 13, color: '#71717a' }}>
          Don't have an account? <a href="/register" style={{ color: '#18181b', fontWeight: 600 }}>Sign Up</a>
        </Text>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
