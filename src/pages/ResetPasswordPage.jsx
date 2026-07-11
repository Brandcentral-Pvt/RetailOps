import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Progress } from 'antd';
import { LockOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import AuthLayout from '../components/auth/AuthLayout';
import { authApi } from '../services/api';

const { Title, Text } = Typography;

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '#e4e4e7', percent: 0 };
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;
  if (score <= 2) return { score, label: 'Weak', color: '#D32F2F', percent: 25 };
  if (score <= 3) return { score, label: 'Fair', color: '#ED6C02', percent: 50 };
  if (score <= 4) return { score, label: 'Good', color: '#0288D1', percent: 75 };
  return { score, label: 'Strong', color: '#2E7D32', percent: 100 };
}

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const pwStrength = getPasswordStrength(password);

  const pwRequirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(password), text: 'One number' },
  ];

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('No reset token provided');
        setLoading(false);
        return;
      }
      try {
        const res = await authApi.validateResetToken(token);
        if (res.valid) {
          setValid(true);
          setUserName(res.firstName || '');
        } else {
          setError(res.message || 'Invalid or expired reset link');
        }
      } catch (e) {
        setError(e.message || 'Failed to validate reset link');
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, [token]);

  const handleSubmit = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await authApi.resetPassword(token, values.newPassword);
      setResetSuccess(true);
    } catch (e) {
      setError(e.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e4e4e7', borderTopColor: '#18181b', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <Text style={{ fontSize: 13, color: '#71717a' }}>Validating reset link...</Text>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AuthLayout>
    );
  }

  if (resetSuccess) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <CheckCircleOutlined style={{ fontSize: 28, color: '#2E7D32' }} />
          </div>
          <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Password Reset!</Title>
          <Text style={{ fontSize: 13, color: '#71717a', display: 'block', marginTop: 8 }}>
            Your password has been updated successfully. You can now sign in with your new password.
          </Text>
          <Button type="primary" onClick={() => navigate('/login')} style={{ marginTop: 20, height: 44, fontWeight: 600, borderRadius: 10, background: '#18181b', borderColor: '#18181b' }}>
            Sign In
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (!valid) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <ExclamationCircleOutlined style={{ fontSize: 28, color: '#C62828' }} />
          </div>
          <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Invalid Link</Title>
          <Text style={{ fontSize: 13, color: '#71717a', display: 'block', marginTop: 8 }}>
            {error || 'This reset link is invalid or has expired.'}
          </Text>
          <Button type="primary" onClick={() => navigate('/forgot-password')} style={{ marginTop: 20, height: 44, fontWeight: 600, borderRadius: 10, background: '#18181b', borderColor: '#18181b' }}>
            Request New Link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#18181b' }}>Reset Password</Title>
        <Text style={{ fontSize: 13, color: '#71717a', display: 'block', marginTop: 4 }}>
          {userName ? `Hi ${userName}, ` : ''}Create a new strong password for your account
        </Text>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 16, borderRadius: 8 }} />
      )}

      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large"
        onValuesChange={(changed) => {
          if (changed.newPassword) setPassword(changed.newPassword);
          if (changed.confirmPassword) setConfirmPassword(changed.confirmPassword);
        }}>
        <Form.Item name="newPassword" rules={[{ required: true, message: 'Password required' }, { min: 8, message: 'Minimum 8 characters' }]}>
          <Input.Password prefix={<LockOutlined style={{ color: '#71717a' }} />} placeholder="New password" />
        </Form.Item>

        {password && (
          <div style={{ marginTop: -8, marginBottom: 16, padding: '8px 12px', background: '#f4f4f5', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: '#71717a' }}>Strength:</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: pwStrength.color }}>{pwStrength.label}</Text>
            </div>
            <Progress percent={pwStrength.percent} strokeColor={pwStrength.color} showInfo={false} size="small" strokeWidth={4} />
          </div>
        )}

        <Form.Item name="confirmPassword" rules={[
          { required: true, message: 'Please confirm password' },
          ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('newPassword') === value ? Promise.resolve() : Promise.reject(new Error('Passwords do not match')); } }),
        ]}>
          <Input.Password prefix={<LockOutlined style={{ color: '#71717a' }} />} placeholder="Confirm new password" />
        </Form.Item>

        <div style={{ marginBottom: 16, padding: '10px 12px', background: '#f4f4f5', borderRadius: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6 }}>Password Requirements</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            {pwRequirements.map((req, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: req.met ? '#2E7D32' : '#71717a' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: req.met ? '#2E7D32' : '#d4d4d8' }} />
                <span>{req.text}</span>
              </div>
            ))}
          </div>
        </div>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={submitting} block
            disabled={!password || !confirmPassword || password !== confirmPassword || password.length < 8}
            style={{ height: 44, fontWeight: 600, borderRadius: 10, background: '#18181b', borderColor: '#18181b' }}>
            Reset Password
          </Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
