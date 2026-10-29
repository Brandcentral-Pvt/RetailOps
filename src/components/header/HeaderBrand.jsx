import React from 'react';
import { Link } from 'react-router-dom';
import { useHeader } from '../../contexts/HeaderContext';
import { Separator } from '@/components/ui/separator';

/**
 * HeaderBrand — breadcrumb + accessible page heading.
 *
 * Breadcrumbs come from RoutePageMeta (populated via HeaderContext.pageMeta).
 * The final breadcrumb is the current page (non-linkable); prior crumbs link
 * back to their route. A shadcn Separator divides crumbs.
 */
export default function HeaderBrand() {
  const { pageMeta } = useHeader();
  const { breadcrumbs = [], title } = pageMeta;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-slate-500"
        >
          {breadcrumbs.map((bc, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <React.Fragment key={bc.label ?? String(i)}>
                {bc.path && !isLast ? (
                  <Link
                    to={bc.path}
                    className="text-[#1976d2] hover:underline transition-colors"
                  >
                    {bc.label}
                  </Link>
                ) : (
                  <span className="text-slate-900">{bc.label}</span>
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
      <h1 className="text-sm font-semibold text-slate-900 leading-none">
        {title}
      </h1>
    </div>
  );
}
