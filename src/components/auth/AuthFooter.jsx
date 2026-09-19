import { ShieldCheck } from 'lucide-react';
import styles from './Auth.module.css';

export default function AuthFooter() {
  return (
    <footer className={styles.footer}>
      <p className={styles.securityBadge}>
        <ShieldCheck size={14} strokeWidth={1.7} aria-hidden="true" />
        <span>Secure enterprise access</span>
      </p>
      <p className={styles.copyright}>
        © {new Date().getFullYear()} BrandCentral <span aria-hidden="true">·</span> RetailOps
      </p>
    </footer>
  );
}
