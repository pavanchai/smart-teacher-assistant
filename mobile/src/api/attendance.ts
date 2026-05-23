import apiClient from './client';
import { AttendanceSession, AttendanceRecord } from '../types';

export interface StartSessionPayload {
  date: string; // YYYY-MM-DD
  mode: 'voice' | 'camera' | 'manual';
}

export interface UpdateRecordsPayload {
  records: AttendanceRecord[];
}

export async function startSession(
  sectionId: string,
  payload: StartSessionPayload
): Promise<AttendanceSession> {
  const response = await apiClient.post<AttendanceSession>(
    `/sections/${sectionId}/sessions`,
    payload
  );
  return response.data;
}

export async function getSession(sessionId: string): Promise<AttendanceSession> {
  const response = await apiClient.get<AttendanceSession>(`/sessions/${sessionId}`);
  return response.data;
}

export async function getTodaySession(sectionId: string): Promise<AttendanceSession | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await apiClient.get<AttendanceSession>(
      `/sections/${sectionId}/sessions/today`,
      { params: { date: today } }
    );
    return response.data;
  } catch {
    return null;
  }
}

export async function updateRecords(
  sessionId: string,
  payload: UpdateRecordsPayload
): Promise<AttendanceSession> {
  const response = await apiClient.put<AttendanceSession>(
    `/sessions/${sessionId}/records`,
    payload
  );
  return response.data;
}

export async function submitSession(sessionId: string): Promise<AttendanceSession> {
  const response = await apiClient.post<AttendanceSession>(`/sessions/${sessionId}/submit`);
  return response.data;
}
