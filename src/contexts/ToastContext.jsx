import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, Bell } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback(({ title, message, type = 'info', duration = 5000, onClick }) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, title, message, type, onClick }]);

        if (duration) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="toast-container-teams">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`teams-toast ${toast.type}`}
                        onClick={() => {
                            if (toast.onClick) toast.onClick();
                            removeToast(toast.id);
                        }}
                    >
                        <div className="teams-toast-icon">
                            <Bell size={18} />
                        </div>
                        <div className="teams-toast-content">
                            <div className="teams-toast-title">{toast.title}</div>
                            <div className="teams-toast-message">{toast.message}</div>
                        </div>
                        <button
                            className="teams-toast-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeToast(toast.id);
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
            <style>{`
                .toast-container-teams {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    pointer-events: none;
                }
                .teams-toast {
                    pointer-events: auto;
                    background: #ffffff;
                    border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    width: 320px;
                    padding: 12px;
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    border-left: 4px solid #6264A7; /* Teams Purple */
                    animation: slideIn 0.3s ease-out;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .teams-toast:hover {
                    transform: translateY(-2px);
                }
                .teams-toast-icon {
                    color: #6264A7;
                    padding-top: 2px;
                }
                .teams-toast-content {
                    flex: 1;
                    min-width: 0;
                }
                .teams-toast-title {
                    font-weight: 700;
                    font-size: 0.9rem;
                    color: #242424;
                    margin-bottom: 2px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .teams-toast-message {
                    font-size: 0.85rem;
                    color: #424242;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .teams-toast-close {
                    background: none;
                    border: none;
                    color: #616161;
                    cursor: pointer;
                    padding: 2px;
                    border-radius: 4px;
                }
                .teams-toast-close:hover {
                    background: #f0f0f0;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </ToastContext.Provider>
    );
};
