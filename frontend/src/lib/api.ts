import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;
  private static instance: ApiClient;

  private constructor() {
    this.client = axios.create({
      baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
            if (refreshToken) {
              const response = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/refresh-token`,
                { refreshToken },
                { withCredentials: true }
              );
              
              const { accessToken, refreshToken: newRefreshToken } = response.data.data;
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', newRefreshToken);
              
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              }
              return this.client(originalRequest);
            }
          } catch {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  get<T>(url: string, params?: object) {
    return this.client.get<T>(url, { params });
  }

  post<T>(url: string, data?: object) {
    return this.client.post<T>(url, data);
  }

  put<T>(url: string, data?: object) {
    return this.client.put<T>(url, data);
  }

  patch<T>(url: string, data?: object) {
    return this.client.patch<T>(url, data);
  }

  delete<T>(url: string) {
    return this.client.delete<T>(url);
  }
}

export const api = ApiClient.getInstance();

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ success: boolean; data: { user: User; accessToken: string; refreshToken: string } }>(
      '/auth/login',
      { email, password }
    ),
  
  requestOtp: (email: string, password: string) =>
    api.post<{ success: boolean; data: { tempToken: string } }>(
      '/auth/request-otp',
      { email, password }
    ),
  
  verifyOtp: (email: string, otp: string, tempToken: string) =>
    api.post<{ success: boolean; data: { user: User; accessToken: string; refreshToken: string } }>(
      '/auth/verify-otp',
      { email, otp, tempToken }
    ),
  
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh-token', { refreshToken }),
  
  logout: () => api.post('/auth/logout'),
  
  getMe: () => api.get<User>('/auth/me'),
};

// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: {
    id: string;
    name: string;
    displayName: string;
  };
  permissions: string[];
  sellerCount: number;
  isFirstLogin: boolean;
  setupCompletedAt?: string;
}

// Sellers API
export const sellersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<{ data: Seller[]; total: number; page: number; limit: number }>('/sellers', { params }),
  
  get: (id: string) => api.get<Seller>(`/sellers/${id}`),
  
  create: (data: Partial<Seller>) => api.post<Seller>('/sellers', data),
  
  update: (id: string, data: Partial<Seller>) => api.patch<Seller>(`/sellers/${id}`, data),
  
  delete: (id: string) => api.delete(`/sellers/${id}`),
  
  getStats: (id: string) => api.get<SellerStats>(`/sellers/${id}/stats`),
};

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

// ASINs API
export const asinsApi = {
  list: (params?: { page?: number; limit?: number; sellerId?: string; search?: string }) =>
    api.get<{ data: Asin[]; total: number }>('/asins', { params }),
  
  get: (id: string) => api.get<Asin>(`/asins/${id}`),
  
  sync: (sellerId: string) => api.post(`/asins/sync/${sellerId}`),
}

export interface Asin {
  id: string;
  sellerId: string;
  asin: string;
  title: string;
  brand?: string;
  category?: string;
  price?: number;
  currency: string;
  imageUrl?: string;
  rating?: number;
  reviewCount: number;
  isActive: boolean;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Dashboard API
export const dashboardApi = {
  getOverview: (params?: { sellerId?: string; period?: string }) =>
    api.get<DashboardOverview>('/dashboard/overview', { params }),
  getCommandCenter: (params?: { sellerId?: string; period?: string; startDate?: string; endDate?: string }) =>
    api.get<DashboardCommandCenter>('/dashboard', { params }),
  
  getRevenue: (params?: { sellerId?: string; period?: string; granularity?: string }) =>
    api.get<RevenueData[]>('/dashboard/revenue', { params }),
  
  getTopProducts: (params?: { sellerId?: string; limit?: number; period?: string }) =>
    api.get<TopProduct[]>('/dashboard/top-products', { params }),
}

export interface DashboardCommandCenter {
  kpi: Array<{ title: string; value: string; trend: number; trendType: string }>;
  labels: string[];
  adsPerformanceSeries: Array<{ name: string; data: number[] }>;
  areaSeries: Array<{ name: string; data: number[] }>;
  category: Array<{ name: string; data: number[]; color: string }>;
  tableData: Array<{ sku: string; asin: string; title: string; category: string; revenue: number; units: number; acos: string }>;
  roas: string;
  dailySpend: string | number;
  userStats: { pending: number; inProgress: number; review: number; completed: number; total: number };
  teamStats: { pending: number; inProgress: number; review: number; completed: number; total: number } | null;
  alerts: Array<{ id: string; type: string; message: string; time: string }>;
  stats: { totalSellers: number; activeSellers: number; totalAsins: number; activeAsins: number; outOfStockAsins: number; newThisMonthAsins: number };
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

// Market Sync API
export const marketSyncApi = {
  sync: (data: { sellerId: string; type: 'full' | 'incremental'; marketplace?: string }) =>
    api.post('/market-sync/sync', data),
  
  getStatus: (taskId: string) => api.get(`/market-sync/status/${taskId}`),
  
  getHistory: (params?: { sellerId?: string; limit?: number }) =>
    api.get<SyncHistory[]>('/market-sync/history', { params }),
}

export interface SyncHistory {
  id: string;
  sellerId: string;
  type: 'full' | 'incremental';
  marketplace: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  recordsProcessed: number;
  recordsFailed: number;
  error?: string;
}