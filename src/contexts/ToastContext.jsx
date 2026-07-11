import React, { createContext, useContext, useCallback } from 'react';
import toast from '../utils/toast';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: (msg, type = 'info') => {
        if (type === 'success') toast.success(msg);
        else if (type === 'error' || type === 'danger') toast.error(msg);
        else if (type === 'warning') toast.warning(msg);
        else if (type === 'loading') toast.loading(msg);
        else toast.info(msg);
      }
    };
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const addToast = useCallback((param, typeParam = 'info', durationParam) => {
    let message = '';
    let type = typeParam;
    let duration = durationParam;

    if (typeof param === 'object' && param !== null && !Array.isArray(param)) {
      message = param.message || '';
      type = param.type || 'info';
      duration = param.duration;
    } else {
      message = String(param);
      type = typeParam;
      duration = durationParam;
    }

    if (type === 'success') toast.success(message, duration);
    else if (type === 'error' || type === 'danger') toast.error(message, duration);
    else if (type === 'warning') toast.warning(message, duration);
    else if (type === 'loading') toast.loading(message);
    else toast.info(message, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, toast }}>
      {children}
    </ToastContext.Provider>
  );
};
