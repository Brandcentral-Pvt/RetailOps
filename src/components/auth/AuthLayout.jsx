import React from 'react';
import { ConfigProvider } from 'antd';
import { motion } from 'framer-motion';
import { ShieldCheck, Radar, Workflow, Lock } from 'lucide-react';
import styles from './Auth.module.css';

const FEATURES = [
  {
    Icon: Radar,
    title: 'Real-time ASIN intelligence',
    text: 'Track 100K+ products across sellers with live pricing, BSR and Buy Box monitoring.',
  },
  {
    Icon: Workflow,
    title: 'Automated data pipelines',
    text: 'Scheduled marketplace ingestion with self-healing sync and integrity repair.',
  },
  {
    Icon: Lock,
    title: 'Enterprise-grade security',
    text: 'OTP-verified access, role-based permissions and full audit logging.',
  },
];

const BrandLogo = () => {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <span className={styles.brandLogoFallback}>
        RetailOps<span className={styles.brandLogoFallbackDot} />
      </span>
    );
  }
  return (
    <img
      src="https://brandcentral.in/wp-content/uploads/2024/09/logo.png"
      alt="RetailOps"
      className={styles.brandLogo}
      onError={() => setFailed(true)}
    />
  );
};

const AuthLayout = ({ children }) => (
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: 'var(--bc-ro-500)',
        borderRadius: 8,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        colorBgContainer: 'var(--bc-white)',
        colorText: '#0B1526',
        colorTextDescription: '#5A6B85',
        colorBorder: '#E5E9F0',
        colorBorderSecondary: '#EDF0F5',
        controlOutline: 'rgba(25, 118, 210, 0.10)',
      },
      components: {
        Button: { controlHeight: 44, borderRadius: 8, fontWeight: 600, fontSize: 14 },
        Input: { controlHeight: 44, borderRadius: 8 },
      },
    }}
  >
    <div className={styles.wrapper}>
      {/* ── Brand panel ── */}
      <aside className={styles.brandPanel}>
        <div className={styles.brandGrid} />
        <div className={styles.brandAccentBar} />

        <div className={styles.brandTop}>
          <BrandLogo />
        </div>

        <motion.div
          className={styles.brandMiddle}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <span className={styles.brandEyebrow}>Marketplace Operations Platform</span>
          <h1 className={styles.brandHeadline}>Every listing, every rupee, one command center.</h1>
          <p className={styles.brandSubline}>
            RetailOps unifies ASIN tracking, advertising analytics and team execution
            for high-volume Amazon businesses.
          </p>

          <div className={styles.featureList}>
            {FEATURES.map(({ Icon, title, text }, i) => (
              <motion.div
                key={title}
                className={styles.featureItem}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.12 }}
              >
                <span className={styles.featureIcon}>
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span>
                  <span className={styles.featureTitle}>{title}</span>
                  <span className={styles.featureText}>{text}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className={styles.brandBottom}>
          <span>&copy; {new Date().getFullYear()} BrandCentral</span>
          <span className={styles.brandMetric}>
            <span className={styles.brandMetricDot} />
            All systems operational
          </span>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className={styles.formPanel}>
        <div className={styles.mobileLogoWrap}>
          <BrandLogo />
        </div>

        <motion.div
          className={styles.formCard}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>

        <div className={styles.formFooter}>
          <span className={styles.securityBadge}>
            <ShieldCheck size={13} color="#1F8A4C" />
            <span className={styles.securityText}>Secured by enterprise encryption</span>
          </span>
          <span className={styles.copyright}>
            &copy; {new Date().getFullYear()} RetailOps · BrandCentral (Easysell Projects)
          </span>
        </div>
      </main>
    </div>
  </ConfigProvider>
);

export default AuthLayout;
