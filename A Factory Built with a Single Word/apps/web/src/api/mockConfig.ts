export type MockModule =
  | 'auth'
  | 'project'
  | 'scenario'
  | 'simulation'
  | 'evolution'
  | 'report'
  | 'resource'
  | 'orchestration'
  | 'search'
  | 'notifications'
  | 'audit'
  | 'dashboard'
  | 'generation';

const globalMock = import.meta.env.VITE_USE_MOCK === 'true';

export const MOCK_CONFIG: Readonly<Record<MockModule, boolean>> = {
  auth: globalMock || import.meta.env.VITE_MOCK_AUTH === 'true',
  project: globalMock || import.meta.env.VITE_MOCK_PROJECT === 'true',
  scenario: globalMock || import.meta.env.VITE_MOCK_SCENARIO === 'true',
  simulation: globalMock || import.meta.env.VITE_MOCK_SIMULATION === 'true',
  evolution: globalMock || import.meta.env.VITE_MOCK_EVOLUTION === 'true',
  report: globalMock || import.meta.env.VITE_MOCK_REPORT === 'true',
  resource: globalMock || import.meta.env.VITE_MOCK_RESOURCE === 'true',
  orchestration: globalMock || import.meta.env.VITE_MOCK_ORCHESTRATION === 'true',
  search: globalMock || import.meta.env.VITE_MOCK_SEARCH === 'true',
  notifications: globalMock || import.meta.env.VITE_MOCK_NOTIFICATIONS === 'true',
  audit: globalMock || import.meta.env.VITE_MOCK_AUDIT === 'true',
  dashboard: globalMock || import.meta.env.VITE_MOCK_DASHBOARD === 'true',
  generation: globalMock || import.meta.env.VITE_MOCK_GENERATION === 'true',
};

export function isMockEnabled(module: MockModule): boolean {
  return MOCK_CONFIG[module];
}
