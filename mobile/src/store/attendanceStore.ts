import { create } from 'zustand';
import { Student, StudentAttendanceState, AttendanceStatus, MarkedBy } from '../types';

interface AttendanceStore {
  sessionId: string | null;
  sectionId: string | null;
  students: StudentAttendanceState[];
  currentIndex: number;
  isRunning: boolean;

  initSession: (sessionId: string, sectionId: string, students: Student[]) => void;
  markStudent: (studentId: string, status: AttendanceStatus, markedBy: MarkedBy) => void;
  setCurrentIndex: (index: number) => void;
  setRunning: (running: boolean) => void;
  reset: () => void;
  getUnmarkedCount: () => number;
  getMarkedCount: () => number;
  getPresentCount: () => number;
  getAbsentCount: () => number;
}

export const useAttendanceStore = create<AttendanceStore>((set, get) => ({
  sessionId: null,
  sectionId: null,
  students: [],
  currentIndex: 0,
  isRunning: false,

  initSession: (sessionId: string, sectionId: string, students: Student[]) => {
    const studentStates: StudentAttendanceState[] = students
      .filter((s) => s.is_active)
      .map((s) => ({
        ...s,
        status: null,
        marked_by: null,
      }));

    set({
      sessionId,
      sectionId,
      students: studentStates,
      currentIndex: 0,
      isRunning: false,
    });
  },

  markStudent: (studentId: string, status: AttendanceStatus, markedBy: MarkedBy) => {
    set((state) => ({
      students: state.students.map((s) =>
        s.id === studentId ? { ...s, status, marked_by: markedBy } : s
      ),
    }));
  },

  setCurrentIndex: (index: number) => {
    set({ currentIndex: index });
  },

  setRunning: (running: boolean) => {
    set({ isRunning: running });
  },

  reset: () => {
    set({
      sessionId: null,
      sectionId: null,
      students: [],
      currentIndex: 0,
      isRunning: false,
    });
  },

  getUnmarkedCount: () => {
    return get().students.filter((s) => s.status === null).length;
  },

  getMarkedCount: () => {
    return get().students.filter((s) => s.status !== null).length;
  },

  getPresentCount: () => {
    return get().students.filter((s) => s.status === 'present').length;
  },

  getAbsentCount: () => {
    return get().students.filter((s) => s.status === 'absent').length;
  },
}));
