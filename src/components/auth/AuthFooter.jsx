import { ShieldCheck } from 'lucide-react';

export default function AuthFooter() {
  return (
    <footer className="mt-9 flex flex-col items-center gap-2 text-center">
      <p className="m-0 inline-flex items-center gap-1.5 text-[11px] leading-5 font-medium text-slate-600">
        <ShieldCheck className="size-3.5 text-emerald-700" strokeWidth={1.7} aria-hidden="true" />
        <span>Secure enterprise access</span>
      </p>
      <p className="m-0 text-xs leading-5 text-slate-600">
        Need access? Contact your administrator.
      </p>
      <p className="m-0 text-[11px] leading-5 text-slate-500">
        © {new Date().getFullYear()} BrandCentral <span aria-hidden="true">·</span> RetailOps
      </p>
    </footer>
  );
}
