/**
 * 仿真时间格式化与防呆工具
 * 抽出为纯函数便于 Vitest 单元测试
 */

/**
 * 将秒数格式化为 HH:MM:SS
 * - 负数会被夹到 0（防呆）
 * - 大于 99 小时仍会正常累加
 */
export function formatSimTime(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * 将两帧的时间差（毫秒）转为安全的秒增量
 * - dt <= 0 视为 0
 * - dt > 1000 视为 tab 休眠，丢弃（保留 1000ms 以支持 1fps 等低帧率场景）
 */
export function safeDeltaSeconds(rawDt: number, speed = 1): number {
  if (rawDt <= 0 || rawDt > 1000) return 0;
  return (rawDt * speed) / 1000;
}
