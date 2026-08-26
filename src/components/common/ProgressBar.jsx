import React from 'react';
import { Progress } from 'antd';

const ProgressBar = ({
    value = 0,
    label = '',
    hint = false,
    color = 'primary',
    size = 'md',
    className = ''
}) => {
    // Map semantic colors to bc tokens
    const getColor = () => {
        if (color === 'primary') return 'var(--bc-primary-600)';
        if (color === 'success') return 'var(--bc-green-600)';
        if (color === 'warning') return 'var(--bc-amber-600)';
        if (color === 'danger') return 'var(--bc-red-600)';
        if (color === 'info') return 'var(--bc-cyan-600)';
        return `var(--bc-${color}-500, var(--bc-primary-600))`;
    };

    const getTrackHeight = () => {
        if (size === 'xs') return 4;
        if (size === 'sm') return 6;
        if (size === 'lg') return 12;
        return 8; // md
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
            <Progress
                percent={percentage}
                showInfo={false}
                strokeColor={getColor()}
                railColor="transparent"
                aria-label={label || 'progress'}
                styles={{
                    rail: { height: getTrackHeight(), borderRadius: '10px', background: 'transparent' },
                    track: { height: getTrackHeight(), borderRadius: '10px' }
                }}
            />
        </div>
    );
};

export default ProgressBar;
