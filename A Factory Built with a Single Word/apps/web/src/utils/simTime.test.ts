import { describe, expect, it } from 'vitest';
import { formatSimTime, safeDeltaSeconds } from '@/utils/simTime';

describe('formatSimTime', () => {
  it('格式化 0 秒为 00:00:00', () => {
    expect(formatSimTime(0)).toBe('00:00:00');
  });

  it('格式化 65 秒为 00:01:05', () => {
    expect(formatSimTime(65)).toBe('00:01:05');
  });

  it('格式化 3600 秒为 01:00:00', () => {
    expect(formatSimTime(3600)).toBe('01:00:00');
  });

  it('格式化 3661 秒为 01:01:01', () => {
    expect(formatSimTime(3661)).toBe('01:01:01');
  });

  it('负数被夹到 0（防呆）', () => {
    // 这是 P0 修复的核心场景：tab 隐藏后 performance.now() 可能产生负 dt 累加
    expect(formatSimTime(-100)).toBe('00:00:00');
    expect(formatSimTime(-1)).toBe('00:00:00');
    expect(formatSimTime(-99999)).toBe('00:00:00');
  });

  it('小数向下取整', () => {
    expect(formatSimTime(59.9)).toBe('00:00:59');
    expect(formatSimTime(0.5)).toBe('00:00:00');
  });

  it('长时间（> 24h）', () => {
    expect(formatSimTime(86400)).toBe('24:00:00');
    expect(formatSimTime(90000)).toBe('25:00:00');
  });
});

describe('safeDeltaSeconds', () => {
  it('正常 dt 转换为秒', () => {
    expect(safeDeltaSeconds(1000)).toBe(1);
    expect(safeDeltaSeconds(500)).toBe(0.5);
    expect(safeDeltaSeconds(16, 2)).toBe(0.032);
  });

  it('speed 倍率', () => {
    expect(safeDeltaSeconds(1000, 2)).toBe(2);
    expect(safeDeltaSeconds(1000, 0.5)).toBe(0.5);
  });

  it('负 dt 视为 0（防呆）', () => {
    expect(safeDeltaSeconds(-100)).toBe(0);
    expect(safeDeltaSeconds(-1)).toBe(0);
  });

  it('dt > 1000ms 视为 tab 休眠，丢弃', () => {
    expect(safeDeltaSeconds(1000)).toBe(1); // 临界
    expect(safeDeltaSeconds(1001)).toBe(0);
    expect(safeDeltaSeconds(10000)).toBe(0);
  });

  it('speed 倍率正确', () => {
    expect(safeDeltaSeconds(500, 2)).toBe(1);
    expect(safeDeltaSeconds(500, 0.5)).toBe(0.25);
  });

  it('典型 60fps 场景', () => {
    // 60fps 一帧约 16.67ms
    const dt = 16.67;
    const result = safeDeltaSeconds(dt);
    expect(result).toBeCloseTo(0.01667, 5);
  });
});
