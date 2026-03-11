import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Popover = ({
    children,
    content,
    trigger = 'hover',
    placement = 'top',
    hoverDelay = 0.5,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef(null);
    const containerRef = useRef(null);

    const handleMouseEnter = () => {
        if (trigger === 'hover') {
            timeoutRef.current = setTimeout(() => {
                setIsOpen(true);
            }, hoverDelay * 1000);
        }
    };

    const handleMouseLeave = () => {
        if (trigger === 'hover') {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setIsOpen(false);
        }
    };

    const togglePopover = () => {
        if (trigger === 'click') {
            setIsOpen(!isOpen);
        }
    };

    // Close on click outside for 'click' trigger
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (trigger === 'click' && isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, trigger]);

    const getPlacementStyles = () => {
        switch (placement) {
            case 'top':
                return { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' };
            case 'bottom':
                return { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' };
            case 'left':
                return { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' };
            case 'right':
                return { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' };
            default:
                return { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' };
        }
    };

    return (
        <div
            ref={containerRef}
            className={`position-relative d-inline-block ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={togglePopover}
        >
            <div className="popover-trigger">
                {children}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: placement === 'top' ? 5 : -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: placement === 'top' ? 5 : -5 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="premium-popover"
                        style={{
                            position: 'absolute',
                            zIndex: 1050,
                            backgroundColor: '#fff',
                            borderRadius: '12px',
                            padding: '12px',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            minWidth: '200px',
                            ...getPlacementStyles()
                        }}
                    >
                        <div className="popover-content" style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.5' }}>
                            {content}
                        </div>
                        {/* Arrow */}
                        <div
                            style={{
                                position: 'absolute',
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#fff',
                                transform: 'rotate(45deg)',
                                border: '1px solid rgba(0,0,0,0.05)',
                                borderTop: placement === 'bottom' ? 'none' : '1px solid rgba(0,0,0,0.05)',
                                borderLeft: placement === 'right' ? 'none' : '1px solid rgba(0,0,0,0.05)',
                                zIndex: -1,
                                ...(placement === 'top' ? { bottom: '-5px', left: '50%', marginLeft: '-4px' } : {}),
                                ...(placement === 'bottom' ? { top: '-5px', left: '50%', marginLeft: '-4px' } : {}),
                                ...(placement === 'left' ? { right: '-5px', top: '50%', marginTop: '-4px' } : {}),
                                ...(placement === 'right' ? { left: '-5px', top: '50%', marginTop: '-4px' } : {}),
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Popover;
