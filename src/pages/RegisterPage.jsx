import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Form, Input, Button, Typography, message } from 'antd';
import { Mail, Lock, ArrowRight, Contact, ShieldCheck } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';

const { Title, Text } = Typography;

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await register({ name: values.name, email: values.email, password: values.password });
      if (result.success) {
        message.success('Account created! Welcome to the enterprise network.');
        navigate('/');
      } else {
        message.error(result.error || 'Registration failed. Access denied.');
      }
    } catch (error) {
      message.error('An unexpected error occurred during account creation.');
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 600, color: '#18181b' }}>Create Account</Title>
        <Text style={{ fontSize: 'var(--font-size-sm)', color: '#71717a', display: 'block', marginTop: 4 }}>Enter your details to get started</Text>
      </div>

      <Form layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
        <Form.Item name="name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input prefix={<Contact size={16} style={{ color: '#71717a' }} />} placeholder="Full name" />
        </Form.Item>
        <Form.Item name="email" rules={[{ required: true, message: 'Email required' }, { type: 'email', message: 'Invalid email' }]}>
          <Input prefix={<Mail size={16} style={{ color: '#71717a' }} />} placeholder="Email address" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Password required' }, { min: 8, message: 'Minimum 8 characters' }]}>
          <Input.Password prefix={<Lock size={16} style={{ color: '#71717a' }} />} placeholder="Password" />
        </Form.Item>
        <Form.Item name="confirmPassword" dependencies={['password']} rules={[
          { required: true, message: 'Please confirm password' },
          ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('Passwords do not match')); } }),
        ]}>
          <Input.Password prefix={<Lock size={16} style={{ color: '#71717a' }} />} placeholder="Confirm password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44, fontWeight: 600, borderRadius: 10, background: '#18181b', borderColor: '#18181b' }}>
            Create Account <ArrowRight size={16} />
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Text style={{ fontSize: 'var(--font-size-sm)', color: '#71717a' }}>
          Already have an account? <Link to="/login" style={{ color: '#18181b', fontWeight: 600 }}>Sign In</Link>
        </Text>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
