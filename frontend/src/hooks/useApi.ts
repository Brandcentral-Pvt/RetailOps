import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { api, authApi, sellersApi, dashboardApi, User } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

interface OtpResponse {
  success: boolean;
  data: {
    tempToken: string;
  };
}

interface VerifyOtpResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

// Auth hooks
export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.login(email, password),
    onSuccess: (response: AxiosResponse<AuthResponse>) => {
      const payload = response.data.data;
      localStorage.setItem('accessToken', payload.accessToken);
      localStorage.setItem('refreshToken', payload.refreshToken);
      setAuth(payload.user, payload.accessToken, payload.refreshToken);
    },
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.requestOtp(email, password),
  });
}

export function useVerifyOtp() {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: ({ email, otp, tempToken }: { email: string; otp: string; tempToken: string }) =>
      authApi.verifyOtp(email, otp, tempToken),
    onSuccess: (response: AxiosResponse<VerifyOtpResponse>) => {
      const payload = response.data.data;
      localStorage.setItem('accessToken', payload.accessToken);
      localStorage.setItem('refreshToken', payload.refreshToken);
      setAuth(payload.user, payload.accessToken, payload.refreshToken);
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => authApi.getMe(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      logout();
    },
  });
}

// Sellers hooks
export function useSellers(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: ['sellers', params],
    queryFn: () => sellersApi.list(params),
    staleTime: 30 * 1000,
  });
}

export function useSeller(id: string) {
  return useQuery({
    queryKey: ['seller', id],
    queryFn: () => sellersApi.get(id),
    enabled: !!id,
  });
}

export function useCreateSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Seller>) => sellersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
    },
  });
}

export function useUpdateSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Seller> }) => sellersApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      queryClient.invalidateQueries({ queryKey: ['seller', variables.id] });
    },
  });
}

// Dashboard hooks
export function useDashboardCommandCenter(params?: { sellerId?: string; period?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'command-center', params],
    queryFn: () => dashboardApi.getCommandCenter(params),
    staleTime: 60 * 1000,
  });
}

export function useDashboardOverview(params?: { sellerId?: string; period?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'overview', params],
    queryFn: () => dashboardApi.getOverview(params),
    staleTime: 60 * 1000,
  });
}

export function useRevenueData(params?: { sellerId?: string; period?: string; granularity?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'revenue', params],
    queryFn: () => dashboardApi.getRevenue(params),
    staleTime: 60 * 1000,
  });
}

export function useTopProducts(params?: { sellerId?: string; limit?: number; period?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'topProducts', params],
    queryFn: () => dashboardApi.getTopProducts(params),
    staleTime: 60 * 1000,
  });
}

// Seller types (shared)
export interface Seller {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  gstin?: string;
  pan?: string;
  isActive: boolean;
  marketplace: 'amazon' | 'ajio' | 'both';
  amazonSellerId?: string;
  amazonMarketplaceId?: string;
  ajioSellerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerStats {
  totalAsins: number;
  activeAsins: number;
  totalRevenue: number;
  totalOrders: number;
  avgRating: number;
  totalReviews: number;
}

export interface DashboardOverview {
  totalRevenue: number;
  totalOrders: number;
  totalAsins: number;
  activeSellers: number;
  revenueGrowth: number;
  ordersGrowth: number;
  asinsGrowth: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  asin: string;
  title: string;
  revenue: number;
  units: number;
  rating: number;
}