/**
 * 领域 API mock 模式单元测试
 * 验证 VITE_USE_MOCK=true 时各 API 函数返回 mock 数据
 */
import { describe, expect, it } from 'vitest';

describe('领域 API mock 模式', () => {
  it('homeStaticData 同步返回 mock', async () => {
    const { homeStaticData } = await import('@/api/modules');
    expect(homeStaticData.cards().length).toBeGreaterThan(0);
    expect(homeStaticData.features().length).toBeGreaterThan(0);
    expect(homeStaticData.steps().length).toBe(7);
    expect(homeStaticData.uploadItems().length).toBe(4);
  });

  it('getTemplates mock 返回所有场景模板', async () => {
    const { getTemplates } = await import('@/api/modules');
    const all = await getTemplates();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty('id');
    expect(all[0]).toHaveProperty('title');
    expect(all[0]).toHaveProperty('category');
  });

  it('getTemplates 按 category 过滤', async () => {
    const { getTemplates } = await import('@/api/modules');
    const scenes = await getTemplates('scene');
    expect(scenes.every((s) => s.category === 'scene')).toBe(true);
    const strategies = await getTemplates('strategy');
    expect(strategies.every((s) => s.category === 'strategy')).toBe(true);
  });

  it('模板详情可直接应用并返回真实项目与场景关联', async () => {
    const { applyTemplate, createProject, getTemplateById } = await import('@/api/modules');
    const template = await getTemplateById('tpl-1');
    expect(template?.data.components.length).toBeGreaterThan(0);

    const project = await createProject({ name: 'Template project' });
    const scenario = await applyTemplate('tpl-1', { project_id: project.id });
    expect(scenario.project_id).toBe(project.id);
    expect(scenario.data).toEqual(template?.data);
  });
  it('场景校验、自动布局和版本历史在 Mock 模式保持同一契约', async () => {
    const {
      autoLayoutScenario,
      createScenario,
      getScenarioVersions,
      validateScenario,
    } = await import('@/api/modules');
    const scenario = await createScenario({ project_id: 'project-1', name: 'Scene' });
    const validation = await validateScenario(scenario.id, scenario.data.components);
    const layout = await autoLayoutScenario(scenario.id, scenario.data.components);
    const versions = await getScenarioVersions(scenario.id);

    expect(validation.valid).toBe(true);
    expect(layout.validation.valid).toBe(true);
    expect(versions[0].scenario_id).toBe(scenario.id);
    expect(versions[0].version).toBe(1);
  });
  it('getSimulation mock 返回运行信息', async () => {
    const { getSimulation } = await import('@/api/modules');
    const run = await getSimulation('mock');
    expect(run).toHaveProperty('id');
    expect(run).toHaveProperty('version');
  });

  it('getSimulationAgents mock 返回 5 个智能体', async () => {
    const { getSimulationAgents } = await import('@/api/modules');
    const agents = await getSimulationAgents('mock');
    expect(agents.length).toBeGreaterThanOrEqual(4);
    expect(agents[0]).toHaveProperty('name');
    expect(agents[0]).toHaveProperty('role');
  });

  it('getEvolutionReport mock 返回完整报告', async () => {
    const { getEvolutionReport } = await import('@/api/modules');
    const report = await getEvolutionReport('mock');
    expect(report).toHaveProperty('id');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('versions');
    expect(report.metrics.length).toBeGreaterThan(0);
  });

  it('getReportKpis mock 返回 6 个 KPI', async () => {
    const { getReportKpis } = await import('@/api/modules');
    const kpis = await getReportKpis('mock');
    expect(kpis.length).toBe(6);
  });

  it('getResourceTemplates 与 getTemplates 一致', async () => {
    const { getResourceTemplates, getTemplates } = await import('@/api/modules');
    const a = await getResourceTemplates();
    const b = await getTemplates();
    expect(a.length).toBe(b.length);
  });

  it('controlSimulation 在 mock 模式下立即返回', async () => {
    const { controlSimulation } = await import('@/api/modules');
    await expect(controlSimulation('mock', 'start')).resolves.toBeUndefined();
    await expect(controlSimulation('mock', 'pause')).resolves.toBeUndefined();
    await expect(controlSimulation('mock', 'stop')).resolves.toBeUndefined();
  });

  it('injectAnomaly 在 mock 模式下立即返回', async () => {
    const { injectAnomaly } = await import('@/api/modules');
    await expect(injectAnomaly('mock', 'road_closed')).resolves.toBeUndefined();
  });
});

describe('认证 API mock', () => {
  it('mockRegister 创建账号后可立即登录', async () => {
    const { mockLogin, mockRegister } = await import('@/api/modules');
    const suffix = Date.now().toString();
    const result = await mockRegister({
      loginName: `user_${suffix}`,
      name: 'New User',
      email: `user_${suffix}@example.com`,
      password: 'password123',
    });
    expect(result.user.role).toBe('operator');
    await expect(mockLogin({ username: `user_${suffix}`, password: 'password123' })).resolves.toMatchObject({
      user: { email: `user_${suffix}@example.com` },
    });
  });

  it('mockLogin 支持演示管理员登录名', async () => {
    const { mockLogin } = await import('@/api/modules');
    const result = await mockLogin({ username: 'admin', password: 'ican2026' });
    expect(result.user.role).toBe('admin');
  });

  it('mockLogin 正确账号返回 token 和 user', async () => {
    const { mockLogin } = await import('@/api/modules');
    const result = await mockLogin({ username: 'Wanzheng', password: 'ican2026' });
    expect(result).toHaveProperty('token');
    expect(result.user.name).toBe('Wanzheng');
  });

  it('mockLogin 支持邮箱登录', async () => {
    const { mockLogin } = await import('@/api/modules');
    const result = await mockLogin({ username: 'admin@ican-platform.com', password: 'ican2026' });
    expect(result.user.role).toBe('admin');
  });

  it('mockLogin 错误密码抛错', async () => {
    const { mockLogin } = await import('@/api/modules');
    await expect(mockLogin({ username: 'Wanzheng', password: 'wrong' })).rejects.toThrow('账号或密码错误');
  });

  it('mockLogout 成功返回', async () => {
    const { mockLogout } = await import('@/api/modules');
    await expect(mockLogout()).resolves.toBeUndefined();
  });

  it('mockUpdateProfile 更新当前用户昵称', async () => {
    const { mockUpdateProfile } = await import('@/api/modules');
    const result = await mockUpdateProfile('u-001', { name: 'AdminNew' });
    expect(result.name).toBe('AdminNew');
  });

  it('mockChangePassword 验证原密码后更新', async () => {
    const { mockChangePassword, mockLogin, resetUserDB } = await import('@/api/modules');
    resetUserDB();
    await mockChangePassword('u-001', 'ican2026', 'newPwd123');
    // 新密码可登录
    const login = await mockLogin({ username: 'Wanzheng', password: 'newPwd123' });
    expect(login.user.id).toBe('u-001');
    // 旧密码不可登录
    await expect(mockLogin({ username: 'Wanzheng', password: 'ican2026' })).rejects.toThrow('账号或密码错误');
    resetUserDB();
  });
});
