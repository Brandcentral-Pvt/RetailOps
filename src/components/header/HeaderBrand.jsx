import React from 'react';
import { Link } from 'react-router-dom';
import { useHeader } from '../../contexts/HeaderContext';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton/Skeleton';
import { HeaderSkeleton } from '@/components/ui/skeleton/HeaderSkeleton';
import { Sparkles, TrendingUp, BarChart, Package } from 'lucide-react';

/**
 * HeaderBrand — modern breadcrumb + accessible page heading with brand identity.
 *
 * Breadcrumbs come from RoutePageMeta (populated via HeaderContext.pageMeta).
 * The final breadcrumb is the current page (non-linkable); prior crumbs link
 * back to their route. A shadcn Separator divides crumbs.
 *
 * Props:
 *   loading - boolean, when true shows skeleton instead of content
 */
function HeaderBrand({ loading = false }) {
  const { pageMeta } = useHeader();
  const { breadcrumbs = [], title, subtitle } = pageMeta;

  if (loading) {
    return <HeaderSkeleton />;
  }

  // Determine page icon based on title
  const getPageIcon = (title) => {
    const t = title?.toLowerCase() || '';
    if (t.includes('dashboard') || t.includes('ops')) return <Layout size={16} className="text-[#1976d2]" />;
    if (t.includes('asin') || t.includes('tracker') || t.includes('product')) return <Package size={16} className="text-[#1976d2]" />;
    if (t.includes('gms') || t.includes('analytics') || t.includes('revenue')) return <BarChart size={16} className="text-[#1976d2]" />;
    if (t.includes('task') || t.includes('action') || t.includes('workflow')) return <CheckSquare size={16} className="text-[#1976d2]" />;
    if (t.includes('seller') || t.includes('account')) return <TrendingUp size={16} className="text-[#1976d2]" />;
    if (t.includes('task') || t.includes('template') || t.includes('workflow')) return <Sparkles size={16} className="text-[#1976d2]" />;
    return <Layout size={16} className="text-[#1976d2]" />;
  };

  if (loading) {
    return <HeaderSkeleton />;
  }

  return (
    <div className="flex flex-col gap-1 min-w-0 flex-1 max-w-3xl">
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-slate-500 mb-1"
        >
          {breadcrumbs.map((bc, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <React.Fragment key={bc.label ?? String(i)}>
                {bc.path && !isLast ? (
                  <Link
                    to={bc.path}
                    className="text-[#1976d2] hover:underline transition-colors flex items-center gap-1"
                  >
                    {bc.icon && <bc.icon size={12} className="text-slate-400" />}
                    {bc.label}
                  </Link>
                ) : (
                  <span className="text-slate-900 flex items-center gap-1 font-medium">
                    {bc.icon && <bc.icon size={12} className="text-slate-400" />}
                    {bc.label}
                  </span>
                )}
                {!isLast && (
                  <Separator
                    orientation="vertical"
                    className="h-3.5 w-[1px] mx-1 border-border"
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900 leading-none truncate max-w-[320px]">
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-slate-500 hidden sm:inline-block">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

export default HeaderBrand;