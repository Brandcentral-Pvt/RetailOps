import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../buttons/button';

const DropdownContext = React.createContext(null);

export const Dropdown = {
    Root: ({ children }) => {
        const [isOpen, setIsOpen] = useState(false);
        const rootRef = useRef(null);

        useEffect(() => {
            const handleClickOutside = (event) => {
                if (rootRef.current && !rootRef.current.contains(event.target)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        return (
            <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
                <div className="position-relative d-inline-block" ref={rootRef}>
                    {React.Children.map(children, child => {
                        if (!child) return null;

                        // Explicit Trigger check or first element
                        const isTrigger = child.type === Dropdown.Trigger ||
                            child.props?.isTrigger ||
                            child.type === Button ||
                            child.type?.displayName === 'Button' ||
                            React.Children.toArray(children).indexOf(child) === 0;

                        if (isTrigger) {
                            return React.cloneElement(child, {
                                onClick: (e) => {
                                    if (child.props.onClick) child.props.onClick(e);
                                    setIsOpen(!isOpen);
                                },
                                // Ensure it maintains cursor pointer if it's a div
                                style: { ...child.props.style, cursor: 'pointer' }
                            });
                        }
                        return child;
                    })}
                </div>
            </DropdownContext.Provider>
        );
    },

    Trigger: ({ children, className = '', ...props }) => {
        return <div className={className} {...props}>{children}</div>;
    },

    Popover: ({ children }) => {
        const { isOpen } = React.useContext(DropdownContext);
        if (!isOpen) return null;

        return (
            <div
                className="position-absolute end-0 mt-2 bg-white border rounded shadow-lg overflow-hidden"
                style={{ minWidth: '240px', zIndex: 1050 }}
            >
                {children}
            </div>
        );
    },

    Menu: ({ children }) => (
        <div className="py-1">
            {children}
        </div>
    ),

    Section: ({ children }) => (
        <div className="py-1">
            {children}
        </div>
    ),

    Item: ({ children, icon: Icon, addon, onClick }) => {
        const { setIsOpen } = React.useContext(DropdownContext);

        return (
            <button
                className="dropdown-item d-flex align-items-center justify-content-between px-3 py-2 border-0 bg-transparent w-100 text-start"
                style={{
                    transition: 'background-color 0.2s',
                    cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={(e) => {
                    if (onClick) onClick(e);
                    setIsOpen(false);
                }}
            >
                <div className="d-flex align-items-center gap-2 text-dark">
                    {Icon && <Icon size={18} className="text-secondary" />}
                    <span className="small">{children}</span>
                </div>
                {addon && <span className="text-muted" style={{ fontSize: '0.7rem' }}>{addon}</span>}
            </button>
        );
    },

    Separator: () => <div className="border-top my-1"></div>
};
