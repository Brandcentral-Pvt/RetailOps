import { message } from 'antd';

message.config({
  top: 24,
  duration: 3,
  maxCount: 3,
  rtl: false,
});

const toast = {
  success: (content, duration = 3) => {
    message.success(content, duration);
  },

  error: (content, duration = 4) => {
    message.error(content, duration);
  },

  warning: (content, duration = 3) => {
    message.warning(content, duration);
  },

  info: (content, duration = 3) => {
    message.info(content, duration);
  },

  loading: (content, key) => {
    const k = key || 'loading-' + Date.now();
    message.loading({ content, key: k, duration: 0 });
    return k;
  },

  dismiss: (key) => {
    if (key) message.destroy(key);
  },

  dismissAll: () => {
    message.destroy();
  },

  promise: async (promise, { success, error, loading } = {}) => {
    const key = 'promise-' + Date.now();
    message.loading({ content: loading || 'Loading...', key, duration: 0 });
    try {
      const result = await promise;
      message.success({ content: success || 'Done!', key, duration: 2 });
      return result;
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || error || 'Something went wrong';
      message.error({ content: errorMsg, key, duration: 4 });
      throw err;
    }
  }
};

export default toast;
