import React from 'react';
import { ConfigProvider } from 'antd';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import styles from './Auth.module.css';

const AuthLayout = ({ children, footerText = 'RetailOps' }) => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1976D2',
          borderRadius: 10,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          colorBgContainer: '#FFFFFF',
          colorText: '#111827',
          colorTextDescription: '#4B5563',
        },
        components: {
          Button: { controlHeight: 44, borderRadius: 10, fontWeight: 600, fontSize: 'var(--font-size-base)' },
          Input: { controlHeight: 44, borderRadius: 10 },
        },
      }}
    >
      <div className={styles.wrapper}>
        <div className={styles.bgOrb1} />
        <div className={styles.bgOrb2} />

        <motion.div
          className={styles.container}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.logoWrap}>
            <img
              src="https://brandcentral.in/wp-content/uploads/2024/09/logo.png"
              alt="RetailOps"
              className={styles.logo}
            />
          </div>

          <div className={styles.card}>
            <div className={styles.cardAccent} />
            <div className={styles.cardBody}>
              {children}

              <div className={styles.footer}>
                <div className={styles.securityBadge}>
                  <ShieldCheck size={14} color="#2E7D32" />
                  <span className={styles.securityText}>Secured by enterprise encryption</span>
                </div>
                <span className={styles.copyright}>&copy; {new Date().getFullYear()} RetailOps. All rights reserved.</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </ConfigProvider>
  );
};

export default AuthLayout;
