import React from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from 'antd';
import { ChevronRight } from 'lucide-react';

const Breadcrumbs = ({ items = [], className = '' }) => {
    const breadcrumbItems = items.map((item, index) => {
        const isLast = index === items.length - 1;
        const Icon = item.icon;

        const content = (
            <span
                className="d-flex align-items-center"
                style={{ color: isLast ? '#111827' : 'var(--bc-slate-500)', fontSize: 'var(--font-size-sm)', fontWeight: isLast ? 700 : 500 }}
            >
                {Icon && <Icon size={14} className="me-2" strokeWidth={2.5} />}
                <span>{item.label}</span>
            </span>
        );

        return {
            key: item.route ? (typeof item.route === 'object' ? item.route.path || '/' : item.route) : item.label,
            title: !isLast && item.route ? (
                <Link
                    to={typeof item.route === 'object' ? item.route.path || '/' : item.route}
                    className="d-flex align-items-center text-decoration-none transition-base hover-opacity"
                    style={{ color: 'var(--bc-slate-500)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
                >
                    {Icon && <Icon size={14} className="me-2" strokeWidth={2.5} />}
                    <span>{item.label}</span>
                </Link>
            ) : content,
            ...(isLast ? { 'aria-current': 'page' } : {})
        };
    });

    return (
        <nav aria-label="breadcrumb" className={`${className}`}>
            <Breadcrumb
                items={breadcrumbItems}
                separator={<ChevronRight size={12} strokeWidth={3} className="text-muted opacity-50" aria-hidden="true" />}
                style={{ marginBottom: 0 }}
            />
        </nav>
    );
};

export default Breadcrumbs;
