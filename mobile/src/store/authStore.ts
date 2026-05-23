import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Teacher } from '../types';
import { AUTH_STORAGE_KEY } from '../constants';

interface AuthStore {
  token: string | null;
  teacher: Teacher | null;
  isAuthenticated: boolean;
  login: (token: string, teacher: Teacher) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      teacher: null,
      isAuthenticated: false,

      login: (token: string, teacher: Teacher) => {
        set({
          token,
          teacher,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          token: null,
          teacher: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
