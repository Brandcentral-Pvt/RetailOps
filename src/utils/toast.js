import { message } from 'antd';

let messageInstance = null;

function getConfig(duration = 3) {
  return { duration, style: { borderRadius: 8, fontSize: 13 } };
}

export const toast = {
  success: (content, duration) => {
    message.success(content, getConfig(duration));
  },

  error: (content, duration) => {
    message.error(content, getConfig(duration));
  },

  warning: (content, duration) => {
    message.warning(content, getConfig(duration));
  },

  info: (content, duration) => {
    message.info(content, getConfig(duration));
  },

  loading: (content, key) => {
    return message.loading({ content, key, duration: 0 });
  },

  dismiss: (key) => {
    message.destroy(key);
  },

  promise: async (promise, { success, error, loading }) => {
    const key = 'promise-' + Date.now();
    message.loading({ content: loading || 'Loading...', key, duration: 0 });
    try {
      const result = await promise;
      message.success({ content: success || 'Success', key, duration: 2 });
      return result;
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || error || 'Something went wrong';
      message.error({ content: errorMsg, key, duration: 3 });
      throw err;
    }
  }
};

export default toast;
