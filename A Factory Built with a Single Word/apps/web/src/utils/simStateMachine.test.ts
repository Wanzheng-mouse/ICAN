/**
 * 仿真状态机单元测试
 * 验证 idle / running / paused / injected 转换合法性
 */
import { describe, expect, it } from 'vitest';

type SimStatus = 'idle' | 'running' | 'paused' | 'injected';

interface SimContext {
  status: SimStatus;
  simTime: number;
  robotCount: number;
  movingCount: number;
  eventCount: number;
}

const ANOMALY_TYPES = [
  { key: 'road_closed', label: '道路封闭' },
  { key: 'low_battery', label: '低电量' },
  { key: 'order_surge', label: '订单激增' },
  { key: 'station_down', label: '站点故障' },
];

/**
 * 仿真状态机的纯函数实现
 * 与 Simulation 页面的 handler 保持一致
 */
function createSimController() {
  let status: SimStatus = 'idle';
  let simTime = 0;
  let movingCount = 0;

  const start = (ctx: { robotCount: number; eventCount: number }): SimContext => {
    if (status === 'running') throw new Error('已在运行');
    status = 'running';
    movingCount = ctx.robotCount;
    return snapshot(ctx.robotCount, ctx.eventCount + 1);
  };

  const pause = (ctx: { robotCount: number; eventCount: number }): SimContext => {
    if (status !== 'running') throw new Error('未在运行');
    status = 'paused';
    movingCount = 0;
    return snapshot(ctx.robotCount, ctx.eventCount + 1);
  };

  const stop = (ctx: { robotCount: number; eventCount: number }): SimContext => {
    status = 'idle';
    simTime = 0;
    movingCount = 0;
    return snapshot(ctx.robotCount, ctx.eventCount + 1);
  };

  const injectAnomaly = (type: string, ctx: { robotCount: number; eventCount: number }): SimContext => {
    if (status !== 'running') throw new Error('请先启动仿真');
    const found = ANOMALY_TYPES.find((a) => a.key === type);
    if (!found) throw new Error(`未知异常类型: ${type}`);
    status = 'injected';
    movingCount = Math.max(0, ctx.robotCount - 1);
    setTimeout(() => { status = 'running'; movingCount = ctx.robotCount; }, 1500);
    return snapshot(ctx.robotCount, ctx.eventCount + 1);
  };

  const tick = (deltaSec: number) => {
    if (status === 'running' && deltaSec > 0) {
      simTime = Math.max(0, simTime + deltaSec);
    }
  };

  const snapshot = (robotCount: number, eventCount: number): SimContext => ({
    status,
    simTime,
    robotCount,
    movingCount,
    eventCount,
  });

  return { start, pause, stop, injectAnomaly, tick, getStatus: () => status, getTime: () => simTime };
}

describe('仿真状态机', () => {
  const baseCtx = { robotCount: 10, eventCount: 0 };

  it('初始状态为 idle', () => {
    const c = createSimController();
    expect(c.getStatus()).toBe('idle');
  });

  it('idle → running', () => {
    const c = createSimController();
    const result = c.start(baseCtx);
    expect(result.status).toBe('running');
    expect(result.movingCount).toBe(10);
    expect(result.eventCount).toBe(1);
  });

  it('running → running 抛错（防止重复启动）', () => {
    const c = createSimController();
    c.start(baseCtx);
    expect(() => c.start(baseCtx)).toThrow('已在运行');
  });

  it('running → paused', () => {
    const c = createSimController();
    c.start(baseCtx);
    const result = c.pause(baseCtx);
    expect(result.status).toBe('paused');
    expect(result.movingCount).toBe(0);
  });

  it('paused 状态下不能再次暂停', () => {
    const c = createSimController();
    c.start(baseCtx);
    c.pause(baseCtx);
    expect(() => c.pause(baseCtx)).toThrow('未在运行');
  });

  it('idle 状态下不能注入异常', () => {
    const c = createSimController();
    expect(() => c.injectAnomaly('road_closed', baseCtx)).toThrow('请先启动仿真');
  });

  it('running 状态下可注入 4 种异常', () => {
    const c = createSimController();
    c.start(baseCtx);
    for (const anomaly of ANOMALY_TYPES) {
      const c2 = createSimController();
      c2.start(baseCtx);
      const result = c2.injectAnomaly(anomaly.key, baseCtx);
      expect(result.status).toBe('injected');
      expect(result.movingCount).toBe(9);
    }
  });

  it('未知异常类型抛错', () => {
    const c = createSimController();
    c.start(baseCtx);
    expect(() => c.injectAnomaly('unknown', baseCtx)).toThrow('未知异常类型');
  });

  it('tick 只在 running 状态累加时间', () => {
    const c = createSimController();
    c.tick(1);
    expect(c.getTime()).toBe(0); // idle 不增
    c.start(baseCtx);
    c.tick(1);
    expect(c.getTime()).toBe(1);
    c.pause(baseCtx);
    c.tick(1);
    expect(c.getTime()).toBe(1); // paused 不增
    c.start(baseCtx);
    c.tick(2);
    expect(c.getTime()).toBe(3);
  });

  it('stop 重置时间和状态', () => {
    const c = createSimController();
    c.start(baseCtx);
    c.tick(60);
    expect(c.getTime()).toBe(60);
    c.stop(baseCtx);
    expect(c.getStatus()).toBe('idle');
    expect(c.getTime()).toBe(0);
  });
});
