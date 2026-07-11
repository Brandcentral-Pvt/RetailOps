import React from 'react';
import { ConfigProvider, Typography } from 'antd';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

const { Text } = Typography;

const AuthLayout = ({ children, footerText = 'RetailOps' }) => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#18181b',
          borderRadius: 10,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          colorBgContainer: '#FFFFFF',
          colorText: '#18181b',
          colorTextDescription: '#71717a',
        },
        components: {
          Button: { controlHeight: 44, borderRadius: 10, fontWeight: 600, fontSize: 14 },
          Input: { controlHeight: 44, borderRadius: 10 },
        },
      }}
    >
      <div style={styles.wrapper}>
        <div style={styles.bgOrb1} />
        <div style={styles.bgOrb2} />
        
        <motion.div 
          style={styles.container} 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
        >
          <div style={styles.logoWrap}>
            <img 
              src="https://brandcentral.in/wp-content/uploads/2024/09/logo.png" 
              alt="BrandCentral" 
              style={styles.logo} 
            />
          </div>

          <div style={styles.card}>
            <div style={styles.cardAccent} />
            <div style={styles.cardBody}>
              {children}
              
              <div style={styles.footer}>
                <div style={styles.securityBadge}>
                  <ShieldCheck size={14} color="#2E7D32" />
                  <Text style={styles.securityText}>Secured by enterprise encryption</Text>
                </div>
                <Text style={styles.copyright}>&copy; {new Date().getFullYear()} {footerText}. All rights reserved.</Text>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </ConfigProvider>
  );
};

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    background: '#f4f5f7',
    fontFamily: "'Inter', sans-serif",
  },
  bgOrb1: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(251,79,64,0.08) 0%, transparent 65%)',
    top: '-200px',
    left: '-200px',
  },
  bgOrb2: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 65%)',
    bottom: '-150px',
    right: '-100px',
  },
  container: {
    width: '100%',
    maxWidth: 420,
    padding: '0 20px',
    zIndex: 1,
  },
  logoWrap: {
    textAlign: 'center',
    marginBottom: 24,
  },
  logo: {
    height: 36,
    width: 'auto',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    position: 'relative',
  },
  cardAccent: {
    height: 3,
    background: 'linear-gradient(90deg, #18181b, #4F46E5, #18181b)',
  },
  cardBody: {
    padding: '32px 28px 24px',
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid #f4f4f5',
    textAlign: 'center',
  },
  securityBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  securityText: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: 500,
  },
  copyright: {
    fontSize: 11,
    color: '#a1a1aa',
  },
};

export default AuthLayout;
