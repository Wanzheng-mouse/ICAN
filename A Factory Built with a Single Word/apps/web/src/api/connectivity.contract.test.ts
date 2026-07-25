import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function source(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const connectedPages: Array<[string, string, string[]]> = [
  ['首页', '../pages/Home/index.tsx', ['useDashboardKpis', 'useTemplates', 'createProject', 'createScenario']],
  ['项目中心', '../pages/Projects/index.tsx', ['useProjects', 'useProjectWorkspace', 'useProjectMembers']],
  ['场景编辑器', '../pages/Editor/index.tsx', ['useScenario', 'useSaveScenario', 'useScenarioVersions']],
  ['仿真空间', '../pages/Simulation/index.tsx', ['useSimulationDetail', 'useSimulationStream', 'useControlSimulation']],
  ['方案进化', '../pages/Evolution/index.tsx', ['useEvolutionReport', 'useEvolutionTrend', 'applyEvolution']],
  ['智能编排', '../pages/Orchestration/index.tsx', ['useOrchestrationAgents', 'useOrchestrationQueue', 'useExecuteOrchestration']],
  ['资源中心', '../pages/Resource/index.tsx', ['useResourceTemplates', 'useFeaturedCases', 'useLearningPath']],
  ['搜索', '../pages/Search/index.tsx', ['useAdvancedPlatformSearch']],
  ['通知', '../pages/Notifications/index.tsx', ['useNotifications', 'useMarkNotificationRead']],
  ['运行报告', '../pages/Report/index.tsx', ['useReportKpis', 'useReportDeviceUsages', 'useReportLogPlayback']],
  ['审计日志', '../pages/AuditLogs/index.tsx', ['useAuditLogs']],
  ['帮助中心', '../pages/Help/index.tsx', ['useLearningPath']],
  ['登录', '../pages/Login/index.tsx', ['loginUser']],
  ['注册', '../pages/Login/Register.tsx', ['registerUser']],
  ['个人资料', '../pages/Account/Profile.tsx', ['updateProfile']],
  ['账号安全', '../pages/Account/Settings.tsx', ['changePassword']],
];

describe('页面与真实 API 的连通性守卫', () => {
  it.each(connectedPages)('%s 页面保留真实领域调用', (_name, file, contracts) => {
    const content = source(file);
    for (const contract of contracts) expect(content).toContain(contract);
  });

  it('业务页面不直接读取 mock-data', () => {
    for (const [, file] of connectedPages) {
      expect(source(file)).not.toContain('@ican/mock-data');
    }
  });

  it('仿真实时流保留真实 WebSocket 连接', () => {
    const content = source('../hooks/useSimulationStream.ts');
    expect(content).toContain('new WsClient');
    expect(content).toContain('client.connect()');
    expect(content).toContain('${apiPrefix}/simulations/${simulationId}/stream');
  });

  it('开发环境默认开启总 Mock 和所有领域 Mock', () => {
    const env = source('../../.env.development');
    const mockFlags = env
      .split(/\r?\n/)
      .filter((line) => line.startsWith('VITE_USE_MOCK=') || line.startsWith('VITE_MOCK_'));
    expect(mockFlags.length).toBeGreaterThan(1);
    expect(mockFlags.every((line) => line.endsWith('=true'))).toBe(true);
  });
});
