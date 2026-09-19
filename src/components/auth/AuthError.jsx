import { CircleAlert } from 'lucide-react';
import styles from './Auth.module.css';

export default function AuthError({ message, id = 'auth-error' }) {
  if (!message) return null;

  return (
    <div className={styles.errorBanner} id={id} role="alert" aria-atomic="true">
      <CircleAlert size={16} strokeWidth={1.8} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
