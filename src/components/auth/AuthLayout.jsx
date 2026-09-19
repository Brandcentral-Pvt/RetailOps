import { ConfigProvider } from 'antd';
import AuthFooter from './AuthFooter';
import styles from './Auth.module.css';

const authTheme = {
  token: {
    colorPrimary: '#1976d2',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    colorBgContainer: '#ffffff',
    colorText: '#19283f',
    colorTextDescription: '#5b687c',
    colorBorder: '#ccd6e2',
    controlHeight: 50,
    controlHeightLG: 50,
    fontSize: 14,
  },
  components: {
    Button: { controlHeight: 50, controlHeightLG: 50, borderRadius: 8, fontWeight: 600 },
    Input: { controlHeight: 50, controlHeightLG: 50, borderRadius: 8 },
  },
};

export default function AuthLayout({ children }) {
  return (
    <ConfigProvider theme={authTheme}>
      <main className={styles.wrapper}>
        <div className={styles.container}>
          <div className={styles.logoWrap}>
            <img
              src="/brandcentral-logo.png"
              alt="BrandCentral"
              width="875"
              height="166"
              className={styles.logo}
              fetchPriority="high"
            />
          </div>
          <section className={styles.card} aria-label="RetailOps authentication">
            <div className={styles.cardAccent} aria-hidden="true" />
            <div className={styles.cardBody}>{children}</div>
          </section>
          <AuthFooter />
        </div>
      </main>
    </ConfigProvider>
  );
}
