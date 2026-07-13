import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface UserInfo {
  id: string;
  name: string;
  avatar: string;
  role: 'admin' | 'operator' | 'viewer';
}

interface AppState {
  user: UserInfo;
  token: string | null;
  currentProjectId: string | null;
  theme: 'light' | 'dark';

  setUser: (u: UserInfo) => void;
  setToken: (t: string | null) => void;
  setCurrentProject: (id: string | null) => void;
  logout: () => void;
}

const defaultUser: UserInfo = {
  id: 'u-001',
  name: 'Wanzheng',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wanzheng',
  role: 'admin',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: defaultUser,
      token: null,
      currentProjectId: null,
      theme: 'light',

      setUser: (u) => set({ user: u }),
      setToken: (t) => set({ token: t }),
      setCurrentProject: (id) => set({ currentProjectId: id }),
      logout: () => set({ user: defaultUser, token: null, currentProjectId: null }),
    }),
    {
      name: 'ican-app',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user, currentProjectId: state.currentProjectId }),
    },
  ),
);
