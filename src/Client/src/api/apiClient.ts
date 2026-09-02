import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
  correlationId: string;
  timestamp: string;
}

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: '/',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request Interceptor: Attach Correlation ID & Auth Token
    this.instance.interceptors.request.use(
      (config) => {
        const correlationId = this.generateCorrelationId();
        config.headers['X-Correlation-ID'] = correlationId;

        const token = localStorage.getItem('knm_auth_token');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response Interceptor: Standardized Error Handling
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        const correlationId = error.config?.headers?.['X-Correlation-ID'] || 'UNKNOWN';
        const serverError = error.response?.data as ApiResponse<unknown> | undefined;

        console.error(`[API Error] [${correlationId}]`, {
          status: error.response?.status,
          message: serverError?.errorMessage || error.message,
          errorCode: serverError?.errorCode || 'NETWORK_OR_SERVER_ERROR',
        });

        return Promise.reject({
          status: error.response?.status || 500,
          errorCode: serverError?.errorCode || 'API_REQUEST_FAILED',
          errorMessage: serverError?.errorMessage || error.message || 'فشل الاتصال بالخادم المركزي',
          correlationId,
        });
      }
    );
  }

  private generateCorrelationId(): string {
    return 'req_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  public async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.delete<ApiResponse<T>>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
