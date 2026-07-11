import { message } from 'antd';

export function handleApiError(error, fallbackMessage = 'Something went wrong') {
  console.error('[API Error]', error);
  
  const msg = error?.response?.data?.message 
    || error?.message 
    || fallbackMessage;
  
  message.error(msg);
  return msg;
}

export function handleApiSuccess(successMessage) {
  if (successMessage) {
    message.success(successMessage);
  }
}

export function handleApiWarning(warningMessage) {
  if (warningMessage) {
    message.warning(warningMessage);
  }
}

export function handleAsyncError(error, context = '') {
  const prefix = context ? `[${context}] ` : '';
  console.error(`${prefix}Error:`, error);
  
  const msg = error?.response?.data?.message 
    || error?.message 
    || 'An unexpected error occurred';
  
  message.error(msg);
  return msg;
}
