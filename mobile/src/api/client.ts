import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL } from '../constants';

// We import the store lazily to avoid circular dependencies
let getToken: (() => string | null) | null = null;
let doLogout: (() => void) | null = null;

export function setAuthInterceptorFns(
  tokenFn: () => string | null,
  logoutFn: () => void
) {
  getToken = tokenFn;
  doLogout = logoutFn;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor — attach JWT token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken ? getToken() : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor — handle 401
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (doLogout) {
        doLogout();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
