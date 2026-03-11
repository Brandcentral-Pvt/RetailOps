import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const Breadcrumbs = ({ items = [], className = '' }) => {
    return (
        <nav aria-label="breadcrumb" className={`${className}`}>
            <ol className="breadcrumb mb-0 flex-nowrap overflow-auto py-1" style={{ listStyle: 'none', padding: 0, display: 'flex', alignItems: 'center' }}>
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    const Icon = item.icon;

                    return (
                        <React.Fragment key={index}>
                            <li className={`breadcrumb-item d-flex align-items-center ${isLast ? 'active' : ''}`} aria-current={isLast ? 'page' : undefined}>
                                {!isLast && item.route ? (
                                    <Link
                                        to={typeof item.route === 'object' ? item.route.path || '/' : item.route}
                                        className="d-flex align-items-center text-decoration-none transition-base hover-opacity"
                                        style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}
                                    >
                                        {Icon && <Icon size={14} className="me-2" strokeWidth={2.5} />}
                                        <span>{item.label}</span>
                                    </Link>
                                ) : (
                                    <div
                                        className="d-flex align-items-center"
                                        style={{ color: isLast ? '#111827' : '#64748b', fontSize: '13px', fontWeight: isLast ? 700 : 500 }}
                                    >
                                        {Icon && <Icon size={14} className="me-2" strokeWidth={2.5} />}
                                        <span>{item.label}</span>
                                    </div>
                                )}
                            </li>

                            {!isLast && (
                                <li className="mx-2 d-flex align-items-center text-muted opacity-50" aria-hidden="true">
                                    <ChevronRight size={12} strokeWidth={3} />
                                </li>
                            )}
                        </React.Fragment>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
