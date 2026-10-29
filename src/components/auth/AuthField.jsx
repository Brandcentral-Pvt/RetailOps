import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function AuthField({
  id,
  label,
  error,
  hint,
  trailing,
  inputRef,
  className,
  inputClassName,
  ...inputProps
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id} className="text-[13px] leading-5 font-medium text-slate-700">
        {label}
      </Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 rounded-lg border-slate-500 bg-white px-3.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400',
            'focus-visible:border-[#1d4ed8] focus-visible:ring-[3px] focus-visible:ring-[#1d4ed8]/25',
            trailing && 'pr-12',
            error && 'border-red-600 focus-visible:border-red-700 focus-visible:ring-red-600/25',
            inputClassName
          )}
          {...inputProps}
        />
        {trailing && (
          <div className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500">{trailing}</div>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="m-0 text-xs leading-5 text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="m-0 text-xs leading-5 text-slate-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
