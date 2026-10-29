import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export default function AuthError({ message, id = 'auth-error', className }) {
  if (!message) return null;

  return (
    <Alert
      id={id}
      aria-atomic="true"
      className={cn('mb-[20px] grid-cols-[1rem_1fr] border-red-200 bg-red-50 text-red-700', className)}
    >
      <CircleAlert aria-hidden="true" />
      <AlertDescription className="text-xs leading-5 text-red-700">{message}</AlertDescription>
    </Alert>
  );
}
