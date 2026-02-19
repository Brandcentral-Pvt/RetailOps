import React from 'react';

export const Button = ({
    children,
    className = '',
    color = 'primary',
    iconTrailing: IconTrailing,
    iconLeading: IconLeading,
    ...props
}) => {
    const colorClasses = {
        primary: 'btn-primary',
        secondary: 'btn-outline-secondary',
        ghost: 'btn-link text-decoration-none',
    };

    return (
        <button
            className={`btn ${colorClasses[color] || 'btn-primary'} d-inline-flex align-items-center gap-2 ${className}`}
            {...props}
        >
            {IconLeading && <IconLeading size={18} />}
            {children}
            {IconTrailing && <IconTrailing size={18} />}
        </button>
    );
};
Button.displayName = 'Button';
