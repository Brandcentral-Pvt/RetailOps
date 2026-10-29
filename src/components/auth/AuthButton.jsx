import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AuthButton({
  children,
  loading,
  loadingText,
  success,
  successText,
  disabled,
  className,
  ...props
}) {
  return (
    <Button
      {...props}
      type="submit"
      className={cn(
        'h-12 w-full rounded-lg bg-[#1d4ed8] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1e40af] focus-visible:border-[#1e40af] focus-visible:ring-[3px] focus-visible:ring-[#1d4ed8]/35 disabled:bg-slate-200 disabled:text-slate-700 disabled:opacity-100',
        success && 'bg-emerald-700 hover:bg-emerald-700 disabled:bg-emerald-700 disabled:text-white',
        className
      )}
      disabled={disabled || loading || success}
      aria-busy={loading || undefined}
    >
      {loading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
      )}
      {success && <Check className="size-[18px]" strokeWidth={2} aria-hidden="true" />}
      <span>{success ? successText : loading ? loadingText : children}</span>
      {!loading && !success && (
        <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
      )}
    </Button>
  );
}
