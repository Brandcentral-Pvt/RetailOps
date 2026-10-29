import { CheckCircle2, Layers, Shield, Zap } from 'lucide-react';
import styles from './AuthVisual.module.css';

const capabilities = [
  {
    icon: Layers,
    title: 'Amazon, Flipkart, Myntra, Meesho & 20+ more',
  },
  {
    icon: Zap,
    title: 'Orders, inventory & shipping on autopilot',
  },
  {
    icon: Shield,
    title: 'Automated reimbursement recovery',
  },
];

const metrics = [
  { label: 'Sellers', value: '700+' },
  { label: 'Marketplaces', value: '20+' },
  { label: 'GMV Processed', value: '₹50Cr+' },
];

export default function AuthVisual() {
  return (
    <aside
      className={`${styles.hero} relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center px-16 xl:px-24`}
      aria-label="Platform overview"
    >
      <span className={styles.glow} aria-hidden="true" />
      <span className={styles.dots} aria-hidden="true" />

      <div className="relative z-10 flex w-full max-w-[580px] flex-col gap-10">
        <div>
          <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm">
            <span className="flex size-5 items-center justify-center rounded-full bg-[#1d4ed8] text-white">
              <Zap size={12} fill="currentColor" aria-hidden="true" />
            </span>
            RetailOps
          </span>
        </div>

        <div>
          <h2 className="m-0 text-4xl leading-[1.2] font-semibold text-white xl:text-[3.2rem]">
            Sell everywhere.
            <br />
            Run it all from one place.
          </h2>
          <p className="m-0 mt-[20px] max-w-[480px] text-[15px] leading-relaxed text-white/85">
            Connect every Indian marketplace, automate your daily operations, and recover every
            rupee — RetailOps handles the busywork so you can focus on growth.
          </p>
        </div>

        <ul className="m-0 mt-2 grid list-none gap-6 p-0">
          {capabilities.map(({ icon: Icon, title }) => (
            <li key={title} className="flex items-center gap-4">
              <span className="flex size-[42px] shrink-0 items-center justify-center rounded-xl border border-white/25 text-white">
                <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="text-[15px] font-medium text-white">{title}</span>
            </li>
          ))}
        </ul>

        <div className={`${styles.preview} mt-8 flex items-center justify-between rounded-2xl border border-white/15 p-6`}>
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`flex-1 text-center ${index !== metrics.length - 1 ? 'border-r border-white/20' : ''}`}
            >
              <p className="m-0 text-2xl font-bold text-white">{metric.value}</p>
              <p className="m-0 mt-1 text-xs text-white/85">{metric.label}</p>
            </div>
          ))}
        </div>

        <p className="m-0 flex items-center gap-2 text-xs font-medium text-white/90">
          <CheckCircle2 className="size-4 text-emerald-300" strokeWidth={1.8} aria-hidden="true" />
          Trusted by operations teams across India
        </p>
      </div>
    </aside>
  );
}
