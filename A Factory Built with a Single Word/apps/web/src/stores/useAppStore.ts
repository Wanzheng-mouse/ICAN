import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  department: string;
  avatar: string;
  role: 'admin' | 'operator' | 'viewer';
  preferences?: {
    theme: 'light' | 'dark';
    defaultPage: string;
    demoMode: boolean;
    notifyAlert: boolean;
    notifyTask: boolean;
    notifySystem: boolean;
  };
}

interface AppState {
  user: UserInfo | null;
  token: string | null;
  remember: boolean;              // true=localStorage(跨进程) false=browser-close 丢失
  preferencesByUserId: Record<string, NonNullable<UserInfo['preferences']>>;
  currentProjectId: string | null;
  currentScenarioId: string | null;
  currentSimulationId: string | null;
  currentEvolutionId: string | null;
  simulationConnectionState: 'idle' | 'connected' | 'reconnecting' | 'error';

  login: (user: UserInfo, token: string, remember?: boolean) => void;
  logout: () => void;
  setUser: (u: UserInfo) => void;

  setProjectContext: (ctx: { projectId?: string; scenarioId?: string; simulationId?: string; evolutionId?: string }) => void;
  clearProjectContext: () => void;
  setSimulationConnectionState: (state: 'idle' | 'connected' | 'reconnecting' | 'error') => void;
  updatePreferences: (p: Partial<NonNullable<UserInfo['preferences']>>) => void;
}

const defaultPreferences = {
  theme: 'light' as const,
  defaultPage: '/',
  demoMode: false,
  notifyAlert: true,
  notifyTask: true,
  notifySystem: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      remember: false,
      preferencesByUserId: {},
      currentProjectId: null,
      currentScenarioId: null,
      currentSimulationId: null,
      currentEvolutionId: null,
      simulationConnectionState: 'idle',

      login: (user, token, remember = false) =>
        set((state) => {
          const preferences = {
            ...defaultPreferences,
            ...user.preferences,
            ...state.preferencesByUserId[user.id],
          };
          return {
            user: { ...user, preferences },
            token,
            remember,
            preferencesByUserId: { ...state.preferencesByUserId, [user.id]: preferences },
          };
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          remember: false,
          currentProjectId: null,
          currentScenarioId: null,
          currentSimulationId: null,
          currentEvolutionId: null,
        }),

      setUser: (u) => set({ user: u }),

      setProjectContext: (ctx) =>
        set((s) => ({
          currentProjectId: ctx.projectId ?? s.currentProjectId,
          currentScenarioId: ctx.scenarioId ?? s.currentScenarioId,
          currentSimulationId: ctx.simulationId ?? s.currentSimulationId,
          currentEvolutionId: ctx.evolutionId ?? s.currentEvolutionId,
        })),

      clearProjectContext: () =>
        set({
          currentProjectId: null,
          currentScenarioId: null,
          currentSimulationId: null,
          currentEvolutionId: null,
        }),

      setSimulationConnectionState: (state) => set({ simulationConnectionState: state }),

      updatePreferences: (p) =>
        set((s) => {
          if (!s.user) return { user: null };
          const preferences = { ...defaultPreferences, ...s.user.preferences, ...p };
          return {
            user: { ...s.user, preferences },
            preferencesByUserId: { ...s.preferencesByUserId, [s.user.id]: preferences },
          };
        }),
    }),
    {
      name: 'ican-app',
      storage: createJSONStorage(() => localStorage),
      // remember=true → 跨进程保留；remember=false → 冷启动时通过 condition 丢弃
      partialize: (state) => {
        if (!state.remember) {
          return { remember: false, user: null, token: null, preferencesByUserId: state.preferencesByUserId };
        }
        return {
          user: state.user,
          token: state.token,
          remember: state.remember,
          preferencesByUserId: state.preferencesByUserId,
          currentProjectId: state.currentProjectId,
          currentScenarioId: state.currentScenarioId,
          currentSimulationId: state.currentSimulationId,
          currentEvolutionId: state.currentEvolutionId,
        };
      },
    },
  ),
);
