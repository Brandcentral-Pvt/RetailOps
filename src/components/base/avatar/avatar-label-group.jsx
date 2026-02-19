import React from 'react';

export const AvatarLabelGroup = ({ src, title, subtitle, status, size = 'md' }) => {
    const sizes = {
        sm: 32,
        md: 40,
        lg: 48
    };
    const sizeVal = sizes[size] || sizes.md;

    return (
        <div className="d-flex align-items-center gap-3">
            <div className="position-relative" style={{ width: sizeVal, height: sizeVal }}>
                <img
                    src={src}
                    alt={title}
                    className="rounded-circle object-fit-cover"
                    style={{ width: '100%', height: '100%' }}
                />
                {status === 'online' && (
                    <span
                        className="position-absolute bottom-0 end-0 bg-success border border-white border-2 rounded-circle"
                        style={{ width: '12px', height: '12px' }}
                    ></span>
                )}
            </div>
            <div className="d-flex flex-column">
                <span className="fw-semibold text-dark small mb-0">{title}</span>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>{subtitle}</span>
            </div>
        </div>
    );
};
