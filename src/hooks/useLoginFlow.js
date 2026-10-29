import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import { AuthRequestError, hasAuthSession, maskDestination, safeAuthError } from '../services/authRequest';

const emptyOtp = () => Array(6).fill('');
const initialState = {
  stage: 'login', status: 'idle', email: '', password: '',
  challenge: null, otp: emptyOtp(), trustDevice: false,
  error: null, notice: '', retryAt: 0,
};

function lifetime(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;
}

/**
 * Credential inputs must always be primitives. React change handlers, masked
 * inputs and future call sites can hand over an event or an object; storing it
 * verbatim would render "[object Object]" inside the controlled input.
 */
function normalizeCredential(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const candidate = value.target?.value ?? value.currentTarget?.value ?? value.value;
    return typeof candidate === 'string' ? candidate : '';
  }
  return '';
}

function successPause(signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Request cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 200);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export default function useLoginFlow() {
  const { login, completeLogin } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState(initialState);
  // A synchronous lock prevents duplicate submissions before React renders.
  // The controller also prevents an old request from completing after Back.
  const requestRef = useRef(null);

  useEffect(() => () => { requestRef.current?.abort(); }, []);

  const isCurrent = controller => requestRef.current === controller && !controller.signal.aborted;

  async function finishLogin(result, controller) {
    if (!hasAuthSession(result)) throw new AuthRequestError('SERVER_ERROR');
    if (!isCurrent(controller)) return;
    setState(previous => ({ ...previous, status: 'success', error: null, notice: '' }));
    await successPause(controller.signal);
    if (!isCurrent(controller)) return;
    await completeLogin(result);
    if (!isCurrent(controller)) return;
    const setupRequired = result.requiresSetup || result.needsPasswordReset || result.forcePasswordReset
      || result.data?.requiresSetup || result.data?.needsPasswordReset;
    navigate(setupRequired ? '/setup-wizard' : '/', { replace: true });
  }

  function fail(error, controller, operation) {
    if (!isCurrent(controller)) return;
    const safe = safeAuthError(error);
    setState(previous => ({
      ...previous,
      status: 'error',
      error: safe,
      notice: '',
      retryAt: safe.code === 'RATE_LIMITED' ? Date.now() + Math.max(60, safe.retryAfter) * 1000 : previous.retryAt,
      challenge: operation === 'resend' && safe.code === 'RATE_LIMITED'
        ? { ...previous.challenge, resendAt: Date.now() + Math.max(60, safe.retryAfter) * 1000 }
        : previous.challenge,
    }));
  }

  function release(controller) {
    if (requestRef.current === controller) requestRef.current = null;
  }

  async function submitLogin() {
    if (requestRef.current || state.status === 'success' || state.retryAt > Date.now()) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setState(previous => ({ ...previous, status: 'authenticating', error: null }));
    try {
      const result = await login(normalizeCredential(state.email).trim(), normalizeCredential(state.password), { deferSession: true, signal: controller.signal });
      if (!isCurrent(controller)) return;
      if (!result.success) throw result;
      if (result.requiresOtp) {
        if (!result.tempToken) throw new AuthRequestError('SERVER_ERROR');
        const now = Date.now();
        setState(previous => ({
          ...previous,
          stage: 'otp', status: 'idle', password: '', otp: emptyOtp(), error: null, notice: '', retryAt: 0,
          challenge: {
            tempToken: result.tempToken,
            destination: maskDestination(result.destination, previous.email),
            expiresAt: now + lifetime(result.expiresIn, 300) * 1000,
            resendAt: now + lifetime(result.resendCooldown, 60) * 1000,
          },
        }));
      } else {
        await finishLogin(result, controller);
      }
    } catch (error) {
      fail(error, controller, 'login');
    } finally {
      release(controller);
    }
  }

  async function verifyOtp() {
    if (requestRef.current || !state.challenge || state.status === 'success' || state.retryAt > Date.now()) return;
    if (['SESSION_EXPIRED', 'OTP_ATTEMPTS', 'OTP_DAILY_LIMIT'].includes(state.error?.code)) return;
    if (state.challenge.expiresAt <= Date.now()) {
      setState(previous => ({ ...previous, error: safeAuthError(new AuthRequestError('OTP_EXPIRED')) }));
      return;
    }
    const code = state.otp.join('');
    if (!/^\d{6}$/.test(code)) {
      setState(previous => ({ ...previous, error: safeAuthError(new AuthRequestError('OTP_INCOMPLETE')) }));
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setState(previous => ({ ...previous, status: 'verifying', error: null, notice: '' }));
    try {
      const result = await authApi.verifyOtp(state.challenge.tempToken, code, state.trustDevice, { deferSession: true, signal: controller.signal });
      if (isCurrent(controller)) await finishLogin(result, controller);
    } catch (error) {
      fail(error, controller, 'verify');
    } finally {
      release(controller);
    }
  }

  async function resendOtp() {
    if (requestRef.current || !state.challenge || state.status === 'success' || state.challenge.resendAt > Date.now()) return;
    if (['SESSION_EXPIRED', 'OTP_DAILY_LIMIT'].includes(state.error?.code)) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setState(previous => ({ ...previous, status: 'resending', error: null, notice: '' }));
    try {
      const result = await authApi.resendOtp(state.challenge.tempToken, { signal: controller.signal });
      if (!isCurrent(controller)) return;
      const now = Date.now();
      setState(previous => ({
        ...previous, status: 'idle', otp: emptyOtp(), error: null, notice: 'A new code has been sent.', retryAt: 0,
        challenge: {
          ...previous.challenge,
          tempToken: result.tempToken || previous.challenge.tempToken,
          destination: maskDestination(result.destination || previous.challenge.destination, previous.email),
          expiresAt: now + lifetime(result.expiresIn, 300) * 1000,
          resendAt: now + lifetime(result.resendCooldown, 60) * 1000,
        },
      }));
    } catch (error) {
      fail(error, controller, 'resend');
    } finally {
      release(controller);
    }
  }

  function backToLogin() {
    if (state.status === 'success') return;
    requestRef.current?.abort();
    requestRef.current = null;
    setState(previous => ({ ...initialState, email: previous.email, otp: emptyOtp() }));
  }

  function updateCredentials(field, value) {
    if (field !== 'email' && field !== 'password') return;
    setState(previous => ({ ...previous, [field]: normalizeCredential(value), error: null }));
  }

  return {
    ...state,
    submitLogin, verifyOtp, resendOtp, backToLogin,
    setEmail: value => updateCredentials('email', value),
    setPassword: value => updateCredentials('password', value),
    setOtp: otp => setState(previous => ({ ...previous, otp, error: null, notice: '' })),
    setTrustDevice: trustDevice => setState(previous => ({ ...previous, trustDevice })),
  };
}
