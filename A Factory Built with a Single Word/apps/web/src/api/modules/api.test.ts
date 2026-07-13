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

  it('getSimulationRun mock 返回运行信息', async () => {
    const { getSimulationRun } = await import('@/api/modules');
    const run = await getSimulationRun();
    expect(run).toHaveProperty('id');
    expect(run).toHaveProperty('version');
    expect(run).toHaveProperty('strategy');
  });

  it('getSimulationAgents mock 返回 5 个智能体', async () => {
    const { getSimulationAgents } = await import('@/api/modules');
    const agents = await getSimulationAgents();
    expect(agents.length).toBeGreaterThanOrEqual(4);
    expect(agents[0]).toHaveProperty('name');
    expect(agents[0]).toHaveProperty('role');
    expect(agents[0]).toHaveProperty('details');
  });

  it('getEvolutionReport mock 返回完整报告', async () => {
    const { getEvolutionReport } = await import('@/api/modules');
    const report = await getEvolutionReport();
    expect(report).toHaveProperty('id');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('versions');
    expect(report.metrics.length).toBeGreaterThan(0);
  });

  it('getReportKpis mock 返回 6 个 KPI', async () => {
    const { getReportKpis } = await import('@/api/modules');
    const kpis = await getReportKpis();
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
    await expect(controlSimulation('start')).resolves.toBeUndefined();
    await expect(controlSimulation('pause')).resolves.toBeUndefined();
    await expect(controlSimulation('stop')).resolves.toBeUndefined();
  });

  it('injectAnomaly 在 mock 模式下立即返回', async () => {
    const { injectAnomaly } = await import('@/api/modules');
    await expect(injectAnomaly('road_closed')).resolves.toBeUndefined();
  });
});
