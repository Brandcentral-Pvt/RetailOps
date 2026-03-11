import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

const Password = ({
    value,
    onChange,
    placeholder = 'Enter password',
    label,
    error,
    className = ''
}) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <div className={`password-input-group mb-3 ${className}`}>
            {label && (
                <label className="form-label smallest fw-700 text-muted text-uppercase mb-1" style={{ fontSize: '10px' }}>
                    {label}
                </label>
            )}
            <div className="position-relative">
                <div className="position-absolute h-100 d-flex align-items-center ps-3 text-muted" style={{ pointerEvents: 'none', zIndex: 5 }}>
                    <Lock size={14} strokeWidth={2.5} />
                </div>
                <input
                    type={showPassword ? 'text' : 'password'}
                    className={`form-control ps-5 pe-5 py-2 fw-600 transition-base ${error ? 'border-danger' : 'border-light shadow-xs'}`}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    style={{
                        borderRadius: '12px',
                        backgroundColor: '#fff',
                        fontSize: '13px',
                        borderWidth: '1px',
                        borderColor: '#e2e8f0'
                    }}
                />
                <button
                    type="button"
                    onClick={toggleVisibility}
                    className="btn position-absolute top-0 end-0 h-100 px-3 border-0 d-flex align-items-center text-muted hover-opacity"
                    tabIndex="-1"
                    style={{
                        background: 'transparent',
                        zIndex: 5
                    }}
                >
                    {showPassword ? (
                        <EyeOff size={16} strokeWidth={2.5} />
                    ) : (
                        <Eye size={16} strokeWidth={2.5} />
                    )}
                </button>
            </div>
            {error && (
                <div className="text-danger smallest mt-1 fw-600" style={{ fontSize: '10px' }}>
                    {error}
                </div>
            )}
        </div>
    );
};

export default Password;
