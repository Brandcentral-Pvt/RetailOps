import { ArrowRight, Check } from 'lucide-react';
import styles from './Auth.module.css';

export default function AuthButton({ children, loading, loadingText, success, successText, disabled, ...props }) {
  return (
    <button
      {...props}
      type="submit"
      className={`${styles.primaryButton} ${success ? styles.primaryButtonSuccess : ''}`}
      disabled={disabled || loading || success}
      aria-busy={loading || undefined}
    >
      {loading && <span className={styles.buttonSpinner} aria-hidden="true" />}
      {success && <Check size={18} strokeWidth={2} aria-hidden="true" />}
      <span>{success ? successText : loading ? loadingText : children}</span>
      {!loading && !success && <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />}
    </button>
  );
}
