import React from 'react';

/**
 * BadgeWithDot Component
 * 
 * @param {string} type - 'pill-color' | 'basic'
 * @param {string} color - 'brand' | 'success' | 'warning' | 'danger' | 'neutral'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {React.ReactNode} children - Content of the badge
 */
const BadgeWithDot = ({ type = 'pill-color', color = 'brand', size = 'md', children }) => {

    const getColorStyles = (c) => {
        switch (c) {
            case 'brand': return { bg: 'var(--bc-blue-50)', text: '#0288D1', dot: '#0288D1' }; // blue-50, blue-500
            case 'success': return { bg: 'var(--bc-green-50)', text: '#2E7D32', dot: '#2E7D32' }; // green-50, green-500
            case 'warning': return { bg: '#fefce8', text: '#eab308', dot: '#eab308' }; // yellow-50, yellow-500
            case 'danger': return { bg: 'var(--bc-red-50)', text: '#D32F2F', dot: '#D32F2F' }; // red-50, red-500
            case 'neutral': return { bg: 'var(--bc-slate-50)', text: 'var(--bc-slate-500)', dot: 'var(--bc-slate-400)' }; // slate-50, slate-500
            default: return { bg: 'var(--bc-blue-50)', text: '#0288D1', dot: '#0288D1' };
        }
    };

    const styles = getColorStyles(color);

    const baseStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: '600',
        borderRadius: 'var(--radius-full)',
        lineHeight: 1,
        transition: 'all 0.2s ease'
    };

    const sizeStyles = {
        sm: { fontSize: '0.7rem', padding: '4px 8px' },
        md: { fontSize: '0.8rem', padding: '6px 12px' },
        lg: { fontSize: '0.9rem', padding: '8px 16px' }
    };

    const typeStyles = type === 'pill-color' ? {
        backgroundColor: styles.bg,
        color: styles.text,
        border: `1px solid ${styles.bg}` // subtle border
    } : {
        backgroundColor: 'transparent',
        color: styles.text,
        border: '1px solid #e2e8f0'
    };

    const dotStyle = {
        width: size === 'sm' ? '6px' : '8px',
        height: size === 'sm' ? '6px' : '8px',
        borderRadius: '50%',
        backgroundColor: styles.dot
    };

    return (
        <span style={{ ...baseStyle, ...sizeStyles[size], ...typeStyles }}>
            <span style={dotStyle}></span>
            {children}
        </span>
    );
};

export default BadgeWithDot;
