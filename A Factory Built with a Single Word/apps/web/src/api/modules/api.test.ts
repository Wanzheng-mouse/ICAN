/**
 * 领域 API contract 守卫
 *
 * 前端模块层只做「URL + 方法 + 入参」的封装，数据契约由后端 OpenAPI
 * 与 api/dtos 保证。这里将 axios 客户端 mock 成内存存储，断言每个模块
 * 仍然调用约定的真实路径与 HTTP 方法，并原样透传响应 —— 无需启动后端，
 * 也不会把契约测试变成脆弱的网络测试。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => {
  const projects: Array<Record<string, unknown>> = [];
  const scenarios: Array<Record<string, unknown>> = [];
  const simulations: Array<Record<string, unknown>> = [];
  const calls: Array<{ method: string; url: string; data?: unknown }> = [];
  return { projects, scenarios, simulations, calls };
});

vi.mock('@/api/client', () => ({
  BASE_URL: '',
  client: {},
  request: vi.fn(async (config: { url?: string; method?: string; data?: unknown; params?: unknown }) => {
    const url = String(config.url ?? '');
    const method = (config.method ?? 'GET').toUpperCase();
    store.calls.push({ method, url, data: config.data });

    if (method === 'POST' && url.endsWith('/projects')) {
      const payload = config.data as { name?: string; requirement?: string };
      const project = {
        id: `proj-${store.projects.length + 1}`,
        name: payload?.name ?? '',
        requirement: payload?.requirement ?? '',
        status: 'draft',
        created_at: new Date().toISOString(),
      };
      store.projects.push(project);
      return project;
    }
    if (method === 'GET' && url.endsWith('/projects')) {
      return [...store.projects];
    }
    if (method === 'POST' && url.endsWith('/scenarios')) {
      const payload = config.data as { project_id?: string; name?: string; data?: unknown };
      const scenario = {
        id: `scn-${store.scenarios.length + 1}`,
        project_id: payload?.project_id ?? '',
        name: payload?.name ?? '',
        data: payload?.data ?? {},
        version: 1,
        updated_at: new Date().toISOString(),
      };
      store.scenarios.push(scenario);
      return scenario;
    }
    if (method === 'GET' && /\/scenarios\/[^/]+$/.test(url)) {
      const id = url.split('/').pop();
      const scenario = store.scenarios.find((item) => item.id === id);
      if (!scenario) throw new Error(`missing scenario ${id}`);
      return scenario;
    }
    if (method === 'POST' && url.endsWith('/simulations')) {
      const payload = config.data as { project_id?: string; scenario_id?: string };
      const simulation = {
        id: `sim-${store.simulations.length + 1}`,
        project_id: payload?.project_id ?? '',
        scenario_id: payload?.scenario_id ?? '',
        status: 'created',
        config: { scenario_snapshot: { schema_version: '1.0' }, order_count: 5 },
        metrics: {},
        events: [],
        created_at: new Date().toISOString(),
      };
      store.simulations.push(simulation);
      return simulation;
    }
    throw new Error(`unhandled request in contract mock: ${method} ${url}`);
  }),
}));

describe('领域 API contract 守卫', () => {
  beforeEach(() => {
    store.projects.length = 0;
    store.scenarios.length = 0;
    store.simulations.length = 0;
    store.calls.length = 0;
  });

  it('createProject / getProjects 返回一致结构', async () => {
    const { createProject, getProjects } = await import('@/api/modules');
    const project = await createProject({ name: 'Contract Test', requirement: 'test' });
    expect(project.id).toBeTruthy();
    expect(project.name).toBe('Contract Test');

    const projects = await getProjects();
    expect(projects.some((p) => p.id === project.id)).toBe(true);

    expect(store.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST /api/v1/projects',
      'GET /api/v1/projects',
    ]);
  });

  it('createScenario / getScenario 可通过 id 读取', async () => {
    const { createProject, createScenario, getScenario } = await import('@/api/modules');
    const project = await createProject({ name: 'Scenario Test' });
    const scn = await createScenario({
      project_id: project.id,
      name: 'Test Scene',
      data: { schema_version: '1.0', canvas: { width: 1200, height: 800, scale: 1 }, components: [] },
    });
    const read = await getScenario(scn.id);
    expect(read.id).toBe(scn.id);
    expect(read.name).toBe('Test Scene');

    expect(store.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST /api/v1/projects',
      'POST /api/v1/scenarios',
      `GET /api/v1/scenarios/${scn.id}`,
    ]);
  });

  it('createSimulation 返回 scenario_snapshot', async () => {
    const { createProject, createScenario, createSimulation } = await import('@/api/modules');
    const project = await createProject({ name: 'Sim Test' });
    const scn = await createScenario({
      project_id: project.id,
      name: 'Sim Scene',
      data: { schema_version: '1.0', canvas: { width: 1200, height: 800, scale: 1 }, components: [] },
    });
    const sim = await createSimulation({ project_id: project.id, scenario_id: scn.id, order_count: 5 });
    expect(sim.id).toBeTruthy();
    expect(sim.config.scenario_snapshot).toBeDefined();
    expect(store.calls.some((c) => c.method === 'POST' && c.url.endsWith('/simulations'))).toBe(true);
  });
});
