import { toast as sonnerToast } from 'sonner';

const toast = {
  success: (content, duration = 3) => {
    return sonnerToast.success(content, { duration: duration * 1000 });
  },

  error: (content, duration = 4) => {
    return sonnerToast.error(content, { duration: duration * 1000 });
  },

  warning: (content, duration = 3) => {
    return sonnerToast.warning(content, { duration: duration * 1000 });
  },

  info: (content, duration = 3) => {
    return sonnerToast.info(content, { duration: duration * 1000 });
  },

  loading: (content, key) => {
    const k = key || 'loading-' + Date.now();
    sonnerToast.loading(content, { id: k });
    return k;
  },

  dismiss: (key) => {
    if (key) sonnerToast.dismiss(key);
  },

  dismissAll: () => {
    sonnerToast.dismiss();
  },

  promise: async (promise, { success, error, loading } = {}) => {
    const key = 'promise-' + Date.now();
    sonnerToast.loading(loading || 'Loading...', { id: key });
    try {
      const result = await promise;
      sonnerToast.success(success || 'Done!', { id: key, duration: 2000 });
      return result;
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || error || 'Something went wrong';
      sonnerToast.error(errorMsg, { id: key, duration: 4000 });
      throw err;
    }
  }
};

export default toast;
