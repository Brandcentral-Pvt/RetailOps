import React from 'react';
import { motion } from 'framer-motion';

const ProgressBar = ({
    value = 0,
    label = '',
    hint = false,
    color = 'primary',
    size = 'md',
    className = ''
}) => {
    // Map bootstrap-like colors to potential status/theme colors
    const getColorClass = () => {
        if (color === 'primary') return 'bg-primary';
        if (color === 'success') return 'bg-success';
        if (color === 'warning') return 'bg-warning';
        if (color === 'danger') return 'bg-danger';
        if (color === 'info') return 'bg-info';
        return `bg-${color}`;
    };

    const getHeight = () => {
        if (size === 'xs') return '4px';
        if (size === 'sm') return '6px';
        if (size === 'lg') return '12px';
        return '8px'; // md
    };

    const percentage = Math.min(Math.max(0, value), 100);

    return (
        <div className={`progress-wrapper w-100 ${className}`}>
            {(label || hint) && (
                <div className="d-flex justify-content-between align-items-center mb-1">
                    {label && (
                        <span className="smallest fw-bold text-muted text-uppercase tracking-wider" style={{ fontSize: '10px', letterSpacing: '0.05em' }}>
                            {label}
                        </span>
                    )}
                    {hint && (
                        <span className="smallest fw-bold text-dark" style={{ fontSize: '10px' }}>
                            {Math.round(percentage)}%
                        </span>
                    )}
                </div>
            )}
            <div
                className="progress shadow-none bg-transparent border-0 overflow-hidden"
                style={{ height: getHeight(), borderRadius: '10px' }}
            >
                <motion.div
                    className={`progress-bar rounded-pill ${getColorClass()}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{ height: '100%' }}
                />
            </div>
        </div>
    );
};

export default ProgressBar;
