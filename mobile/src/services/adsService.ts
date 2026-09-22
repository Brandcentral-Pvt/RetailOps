import apiClient from './apiClient';

export interface AdsApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface AdsQueryParams {
  startDate?: string;
  endDate?: string;
  period?: string;
  sellerId?: string;
  marketplace?: string;
  campaignId?: string;
  asin?: string;
  sku?: string;
  [key: string]: string | number | undefined;
}

const adsService = {
  async getMeta(params?: AdsQueryParams) {
    const { data } = await apiClient.get<AdsApiResponse>(
      '/ads/meta',
      { params },
    );

    return data.data ?? {};
  },

  async getOverview(params?: AdsQueryParams) {
    const { data } = await apiClient.get<AdsApiResponse>(
      '/ads/overview',
      { params },
    );

    return data.data ?? {};
  },

  async getSeries(params?: AdsQueryParams) {
    const { data } = await apiClient.get<AdsApiResponse>(
      '/ads/series',
      { params },
    );

    return data.data ?? {};
  },

  async getTable(params?: AdsQueryParams) {
    const { data } = await apiClient.get<AdsApiResponse>(
      '/ads/table',
      { params },
    );

    return data.data ?? {};
  },

  async getHistory(params?: AdsQueryParams) {
    const { data } = await apiClient.get<AdsApiResponse>(
      '/ads/history',
      { params },
    );

    return data.data ?? {};
  },

  async getFilterOptions(params?: AdsQueryParams) {
    const { data } = await apiClient.get<AdsApiResponse>(
      '/ads/filter-options',
      { params },
    );

    return data.data ?? {};
  },

  async getInsights(params?: AdsQueryParams) {
    const { data } = await apiClient.get<AdsApiResponse>(
      '/ads/insights',
      { params },
    );

    return data.data ?? {};
  },

  async getReport(params?: AdsQueryParams) {
    const { data } = await apiClient.get<AdsApiResponse>(
      '/ads/report',
      { params },
    );

    return data.data ?? {};
  },

  async aiReview(payload: Record<string, unknown>) {
    const { data } = await apiClient.post<AdsApiResponse>(
      '/ads/ai-review',
      payload,
    );

    return data.data ?? {};
  },
};

export default adsService;