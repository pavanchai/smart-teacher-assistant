export interface Teacher {
  id: string;
  full_name: string;
  email: string;
  school_id: string;
}

export interface Class {
  id: string;
  name: string;
  school_id: string;
  section_count?: number;
}

export interface Section {
  id: string;
  name: string;
  class_id: string;
  student_count?: number;
}

export interface Student {
  id: string;
  roll_number: string;
  full_name: string;
  section_id: string;
  is_active: boolean;
}

export type AttendanceStatus = 'present' | 'absent' | 'late';
export type MarkedBy = 'voice' | 'manual' | 'camera';
export type SessionMode = 'voice' | 'camera' | 'manual';
export type SessionStatus = 'in_progress' | 'submitted';

export interface AttendanceRecord {
  student_id: string;
  status: AttendanceStatus;
  marked_by: MarkedBy;
}

export interface AttendanceSession {
  id: string;
  section_id: string;
  teacher_id: string;
  date: string;
  mode: SessionMode;
  status: SessionStatus;
  records: AttendanceRecord[];
}

export interface StudentAttendanceState extends Student {
  status: AttendanceStatus | null;
  marked_by: MarkedBy | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  teacher: Teacher;
}

export interface OfflineQueueItem {
  id: string;
  sessionId: string;
  records: AttendanceRecord[];
  timestamp: number;
}
