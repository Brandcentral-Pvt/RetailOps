import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { MailOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import AuthLayout from '../components/auth/AuthLayout';
import { authApi } from '../services/api';
import styles from '../components/auth/Auth.module.css';

const { Title, Text } = Typography;

const ForgotPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.forgotPassword(values.email);
      if (res.success) {
        setSent(true);
      } else {
        setError(res.message || 'Failed to send reset link');
      }
    } catch (e) {
      setError(e.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className={styles.textCenter} style={{ padding: '20px 0' }}>
          <div className={styles.statusIconSuccess}>
            <CheckCircleOutlined style={{ fontSize: 28, color: 'var(--text-success)' }} />
          </div>
          <Title level={4} className={styles.statusTitle}>Check Your Email</Title>
          <Text className={styles.statusBody}>
            We've sent a password reset link to your email address. Please check your inbox and click the link to reset your password.
          </Text>
          <Text className={styles.statusHint}>
            Didn't receive the email? Check your spam folder or try again.
          </Text>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => setSent(false)} className={styles.mt16}>
            Back to Forgot Password
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className={styles.header}>
        <Title level={3} className={styles.headerTitle}>Forgot Password?</Title>
        <Text className={styles.headerSubtitle}>
          Enter your email and we'll send you a reset link
        </Text>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 16, borderRadius: 'var(--radius-md)' }} />
      )}

      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large">
        <Form.Item name="email" rules={[{ required: true, message: 'Email required' }, { type: 'email', message: 'Invalid email' }]}>
          <Input prefix={<MailOutlined style={{ color: 'var(--text-secondary)' }} />} placeholder="Enter your email address" autoFocus autoComplete="email" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} block className={styles.authBtn}>
            Send Reset Link
          </Button>
        </Form.Item>
      </Form>

      <div className={styles.mt20} style={{ textAlign: 'center' }}>
        <Link to="/login" className={styles.authLink}>
          <ArrowLeftOutlined style={{ marginRight: 4 }} />Back to Sign In
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
