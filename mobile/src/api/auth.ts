import apiClient from './client';
import { LoginRequest, LoginResponse, Teacher } from '../types';

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const params = new URLSearchParams();
  params.append('username', credentials.email);
  params.append('password', credentials.password);
  const response = await apiClient.post<LoginResponse>('/auth/login', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
}

export async function getMe(): Promise<Teacher> {
  const response = await apiClient.get<Teacher>('/auth/me');
  return response.data;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Ignore errors on logout — we clear local state regardless
  }
}
