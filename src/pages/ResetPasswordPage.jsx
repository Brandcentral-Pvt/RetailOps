import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Progress, Spin } from 'antd';
import { LockOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import AuthLayout from '../components/auth/AuthLayout';
import { authApi } from '../services/api';
import styles from '../components/auth/Auth.module.css';

const { Title, Text } = Typography;

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'var(--border-light)', percent: 0 };
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;
  if (score <= 2) return { score, label: 'Weak', color: 'var(--text-danger)', percent: 25 };
  if (score <= 3) return { score, label: 'Fair', color: 'var(--text-warning)', percent: 50 };
  if (score <= 4) return { score, label: 'Good', color: 'var(--text-brand)', percent: 75 };
  return { score, label: 'Strong', color: 'var(--text-success)', percent: 100 };
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
        <div className={styles.textCenter} style={{ padding: '40px 0' }}>
          <div className={styles.spinner} />
          <Text style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Validating reset link...</Text>
        </div>
      </AuthLayout>
    );
  }

  if (resetSuccess) {
    return (
      <AuthLayout>
        <div className={styles.textCenter} style={{ padding: '20px 0' }}>
          <div className={styles.statusIconSuccess}>
            <CheckCircleOutlined style={{ fontSize: 28, color: 'var(--text-success)' }} />
          </div>
          <Title level={4} className={styles.statusTitle}>Password Reset!</Title>
          <Text className={styles.statusBody}>
            Your password has been updated successfully. You can now sign in with your new password.
          </Text>
          <Button type="primary" onClick={() => navigate('/login')} className={styles.authBtn} style={{ marginTop: 20 }}>
            Sign In
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (!valid) {
    return (
      <AuthLayout>
        <div className={styles.textCenter} style={{ padding: '20px 0' }}>
          <div className={styles.statusIconError}>
            <ExclamationCircleOutlined style={{ fontSize: 28, color: 'var(--text-danger)' }} />
          </div>
          <Title level={4} className={styles.statusTitle}>Invalid Link</Title>
          <Text className={styles.statusBody}>
            {error || 'This reset link is invalid or has expired.'}
          </Text>
          <Button type="primary" onClick={() => navigate('/forgot-password')} className={styles.authBtn} style={{ marginTop: 20 }}>
            Request New Link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className={styles.header}>
        <Title level={3} className={styles.headerTitle}>Reset Password</Title>
        <Text className={styles.headerSubtitle}>
          {userName ? `Hi ${userName}, ` : ''}Create a new strong password for your account
        </Text>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 16, borderRadius: 'var(--radius-md)' }} />
      )}

      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large"
        onValuesChange={(changed) => {
          if (changed.newPassword) setPassword(changed.newPassword);
          if (changed.confirmPassword) setConfirmPassword(changed.confirmPassword);
        }}>
        <Form.Item name="newPassword" rules={[{ required: true, message: 'Password required' }, { min: 8, message: 'Minimum 8 characters' }]}>
          <Input.Password prefix={<LockOutlined style={{ color: 'var(--text-secondary)' }} />} placeholder="New password" autoComplete="new-password" />
        </Form.Item>

        {password && (
          <div className={styles.strengthBar}>
            <div className={styles.strengthHeader}>
              <Text className={styles.strengthLabel}>Strength:</Text>
              <Text className={styles.strengthValue} style={{ color: pwStrength.color }}>{pwStrength.label}</Text>
            </div>
            <Progress percent={pwStrength.percent} strokeColor={pwStrength.color} showInfo={false} size="small" strokeWidth={4} />
          </div>
        )}

        <Form.Item name="confirmPassword" rules={[
          { required: true, message: 'Please confirm password' },
          ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('newPassword') === value ? Promise.resolve() : Promise.reject(new Error('Passwords do not match')); } }),
        ]}>
          <Input.Password prefix={<LockOutlined style={{ color: 'var(--text-secondary)' }} />} placeholder="Confirm new password" autoComplete="new-password" />
        </Form.Item>

        <div className={styles.requirements}>
          <Text className={styles.requirementsTitle}>Password Requirements</Text>
          <div className={styles.requirementsGrid}>
            {pwRequirements.map((req, i) => (
              <div key={i} className={req.met ? styles.requirementMet : styles.requirementUnmet}>
                <div className={req.met ? styles.requirementDotMet : styles.requirementDotUnmet} />
                <span>{req.text}</span>
              </div>
            ))}
          </div>
        </div>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={submitting} block
            disabled={!password || !confirmPassword || password !== confirmPassword || password.length < 8}
            className={styles.authBtn}>
            Reset Password
          </Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
