/**
 * Auth API surface — mirrors `backend/routes/authRoutes.js`.
 * Endpoints are relative to API_BASE_URL (which already includes `/api`).
 */
import apiClient from './apiClient';
import type {
  ChangePasswordResponse,
  LoginResponse,
  RequestPasswordChangeResponse,
  UpdateProfileResponse,
  User,
  VerifyOtpResponse,
} from '../types';

export const authService = {
  /** Step 1 — email + password. May return `requiresOtp` or direct tokens. */
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    return data;
  },

  /** Step 2 — verify the emailed OTP and (optionally) trust this device. */
  async verifyOtp(tempToken: string, otp: string, trustDevice = false): Promise<VerifyOtpResponse> {
    const { data } = await apiClient.post<VerifyOtpResponse>('/auth/verify-otp', {
      tempToken,
      otp,
      trustDevice,
    });
    return data;
  },

  /** Resend a fresh OTP for an in-progress login. */
  async resendOtp(tempToken: string): Promise<{ success: boolean; destination?: string; message?: string }> {
    const { data } = await apiClient.post('/auth/resend-otp', { tempToken });
    return data;
  },

  /** Current user profile (includes permissions + assigned sellers). */
  async getMe(): Promise<User> {
    const { data } = await apiClient.get<{ success: boolean; data: User }>('/auth/me');
    return data.data;
  },

  /** Invalidate the session server-side. */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  /** Update the signed-in user's profile (first/last name, phone, preferences). */
  async updateProfile(data: {
    firstName: string;
    lastName: string;
    phone?: string;
    preferences?: Record<string, unknown>;
  }): Promise<UpdateProfileResponse> {
    const { data: response } = await apiClient.put<UpdateProfileResponse>('/auth/profile', data);
    return response;
  },

  /** Step 1 of password change — verify current password and send an OTP. */
  async requestPasswordChange(currentPassword: string): Promise<RequestPasswordChangeResponse> {
    const { data } = await apiClient.post<RequestPasswordChangeResponse>('/auth/request-password-change', {
      currentPassword,
    });
    return data;
  },

  /** Step 2 of password change — verify the OTP and set the new password. */
  async changePasswordWithOtp(
    tempToken: string,
    otp: string,
    newPassword: string,
  ): Promise<ChangePasswordResponse> {
    const { data } = await apiClient.put<ChangePasswordResponse>('/auth/change-password-with-otp', {
      tempToken,
      otp,
      newPassword,
    });
    return data;
  },

  /** All-in-one password change using the current password (no OTP). */
  async changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> {
    const { data } = await apiClient.put<ChangePasswordResponse>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return data;
  },

  /** Request a password reset email. */
  async forgotPassword(email: string): Promise<{ success: boolean; message?: string }> {
    const { data } = await apiClient.post('/auth/forgot-password', { email });
    return data;
  },
};

export default authService;