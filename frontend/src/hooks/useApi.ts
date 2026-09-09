import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { api, authApi, sellersApi, dashboardApi, marketSyncApi, liveSyncTrackerApi, scraperApi, User, LiveSyncOverview, LiveSyncSeller, LiveSyncActivity, LiveSyncRun } from '@/lib/api';
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

// Live Sync Tracker hooks
export function useLiveSyncOverview(params?: { refreshKey?: number }) {
  return useQuery<LiveSyncOverview>({
    queryKey: ['live-sync', 'overview', params?.refreshKey],
    queryFn: async () => {
      const response = await liveSyncTrackerApi.getOverview();
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useLiveSyncSellers(params?: { refreshKey?: number }) {
  return useQuery<LiveSyncSeller[]>({
    queryKey: ['live-sync', 'sellers', params?.refreshKey],
    queryFn: async () => {
      const response = await liveSyncTrackerApi.getSellers();
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useLiveSyncSellerDetail(sellerId: string, params?: { refreshKey?: number }) {
  return useQuery<LiveSyncSeller>({
    queryKey: ['live-sync', 'seller', sellerId, params?.refreshKey],
    queryFn: async () => {
      const response = await liveSyncTrackerApi.getSellerDetail(sellerId);
      return response.data;
    },
    enabled: !!sellerId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useLiveSyncActivity(params?: { refreshKey?: number; limit?: number }) {
  return useQuery<LiveSyncActivity[]>({
    queryKey: ['live-sync', 'activity', params?.refreshKey, params?.limit],
    queryFn: async () => {
      const response = await liveSyncTrackerApi.getActivity({ limit: params?.limit });
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useLiveSyncRuns(params?: { refreshKey?: number; page?: number; limit?: number; sellerId?: string; status?: string }) {
  return useQuery<LiveSyncRun[]>({
    queryKey: ['live-sync', 'runs', params?.refreshKey, params],
    queryFn: async () => {
      const response = await liveSyncTrackerApi.getRuns(params);
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useLiveSyncTrigger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sellerIds: string[]) => {
      const response = await liveSyncTrackerApi.triggerSync(sellerIds);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-sync'] });
    },
  });
}

// ============================================
// Scraper Hooks (Playwright Scraper)
// ============================================

export interface ScrapeJob {
  jobId: string;
  sellerId: string;
  userId?: string;
  status: 'queued' | 'running' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  progress: number;
  currentBatch: number;
  totalBatches: number;
  startTime: string;
  endTime?: string;
  error?: string;
}

export interface ScrapeJobDetail {
  id: string;
  jobId: string;
  asin: string;
  success: boolean;
  rating: number;
  reviewCount: number;
  hasAplus: boolean;
  verifiedAsin?: string;
  errorMessage?: string;
  durationMs: number;
  scrapedAt: string;
}

export interface ScraperStats {
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  activeJobs: number;
  queuedJobs: number;
  uptime: number;
}

export interface SellerScrapeStats {
  totalScraped: number;
  withAplus: number;
  avgRating: number;
  totalReviews: number;
  withImages: number;
  withBrand: number;
  withCategory: number;
  withAvailability: number;
  withSoldBy: number;
}

export interface SellerScrapeJob {
  id: string;
  jobId: string;
  sellerId: string;
  userId?: string;
  status: string;
  totalAsins: number;
  processed: number;
  successful: number;
  failed: number;
  startTime: string;
  endTime?: string;
  errorMessage?: string;
}

export function useScraperJobs(params?: { sellerId?: string; status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['scraper', 'jobs', params],
    queryFn: () => scraperApi.getJobs(params),
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useScraperJobStatus(jobId: string) {
  return useQuery({
    queryKey: ['scraper', 'job', jobId],
    queryFn: () => scraperApi.getJobStatus(jobId),
    enabled: !!jobId,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });
}

export function useScraperJobDetails(params?: { jobId: string; limit?: number; offset?: number; success?: boolean }) {
  return useQuery({
    queryKey: ['scraper', 'job-details', params],
    queryFn: () => scraperApi.getJobDetails(params!),
    enabled: !!params?.jobId,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useScraperStats() {
  return useQuery({
    queryKey: ['scraper', 'stats'],
    queryFn: () => scraperApi.getStats(),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useSellerScrapeSummary(sellerId: string) {
  return useQuery({
    queryKey: ['scraper', 'seller-summary', sellerId],
    queryFn: () => scraperApi.getSellerSummary(sellerId),
    enabled: !!sellerId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useScraperHistory(params?: { sellerId?: string; status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['scraper', 'history', params],
    queryFn: () => scraperApi.getHistory(params),
    staleTime: 30 * 1000,
  });
}

export function useStartScrapeJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { sellerId: string; asins: string[]; priority?: string; options?: any }) => 
      scraperApi.startJob(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['scraper', 'stats'] });
    },
  });
}

export function useStartBulkScrapeJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { sellerId: string; asinFile: string | string[]; priority?: string; options?: any }) => 
      scraperApi.startBulkJob(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['scraper', 'stats'] });
    },
  });
}

export function useCancelScrapeJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => scraperApi.cancelJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper', 'jobs'] });
    },
  });
}

export function useRetryFailedAsins() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => scraperApi.retryJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['scraper', 'stats'] });
    },
  });
}

export function useExportScrapeJob() {
  return useMutation({
    mutationFn: ({ jobId, format }: { jobId: string; format?: 'csv' | 'json' }) => 
      scraperApi.exportJob(jobId, format),
  });
}

export function useTestScrapeAsin() {
  return useMutation({
    mutationFn: (asin: string) => scraperApi.testScrape(asin),
  });
}

export function useScraperHealth() {
  return useQuery({
    queryKey: ['scraper', 'health'],
    queryFn: () => scraperApi.getHealth(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}