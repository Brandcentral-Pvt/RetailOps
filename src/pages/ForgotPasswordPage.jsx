import React, { useState } from 'react';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { MailOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import AuthLayout from '../components/auth/AuthLayout';
import { authApi } from '../services/api';

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
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <CheckCircleOutlined style={{ fontSize: 28, color: '#2E7D32' }} />
          </div>
          <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Check Your Email</Title>
          <Text style={{ fontSize: 13, color: '#71717a', display: 'block', marginTop: 8, lineHeight: 1.6 }}>
            We've sent a password reset link to your email address. Please check your inbox and click the link to reset your password.
          </Text>
          <Text style={{ fontSize: 12, color: '#a1a1aa', display: 'block', marginTop: 12 }}>
            Didn't receive the email? Check your spam folder or try again.
          </Text>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => setSent(false)} style={{ marginTop: 16, fontSize: 13 }}>
            Back to Forgot Password
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#18181b' }}>Forgot Password?</Title>
        <Text style={{ fontSize: 13, color: '#71717a', display: 'block', marginTop: 4 }}>
          Enter your email and we'll send you a reset link
        </Text>
      </div>

      {error && (
        <Alert title={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 16, borderRadius: 8 }} />
      )}

      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large">
        <Form.Item name="email" rules={[{ required: true, message: 'Email required' }, { type: 'email', message: 'Invalid email' }]}>
          <Input prefix={<MailOutlined style={{ color: '#71717a' }} />} placeholder="Enter your email address" autoFocus />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44, fontWeight: 600, borderRadius: 10, background: '#18181b', borderColor: '#18181b' }}>
            Send Reset Link
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Button type="link" icon={<ArrowLeftOutlined />} href="/login" style={{ fontSize: 13, color: '#71717a' }}>
          Back to Sign In
        </Button>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
