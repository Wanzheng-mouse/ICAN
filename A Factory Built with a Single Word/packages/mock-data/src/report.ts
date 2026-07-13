import type {
  DeviceUsage,
  FulfillmentDay,
  KpiCardData,
  ReportAnomalyBucket,
  ReportSceneRanking,
  ReportTrendPoint,
} from '@ican/contracts';

export const reportKpis: KpiCardData[] = [
  { title: '总运行次数', value: 128, unit: '次', delta: 18.5, trend: 'up', iconColor: '#3b82f6' },
  { title: '平均完成率', value: 92.6, unit: '%', delta: 3.2, trend: 'down', iconColor: '#22c55e' },
  { title: '平均拥堵率', value: 12.8, unit: '%', delta: -2.6, trend: 'down', iconColor: '#f59e0b' },
  { title: '平均能耗', value: 0.82, unit: 'kWh/件', delta: -4.7, trend: 'down', iconColor: '#a855f7' },
  { title: '平均机器人利用率', value: 78.3, unit: '%', delta: 2.1, trend: 'up', iconColor: '#06b6d4' },
  { title: '平均故障恢复成功率', value: 96.7, unit: '%', delta: 1.8, trend: 'up', iconColor: '#10b981' },
];

export const reportTrend: ReportTrendPoint[] = Array.from({ length: 31 }, (_, i) => {
  const day = String(i + 1).padStart(2, '0');
  const completion = 85 + Math.sin(i * 0.5) * 4 + (i % 7 === 0 ? -2 : 0);
  const congestion = 11 + Math.cos(i * 0.4) * 3;
  const energy = 0.78 + Math.sin(i * 0.3) * 0.08;
  return {
    date: `05-${day}`,
    completionRate: Math.round(completion * 10) / 10,
    congestionRate: Math.round(congestion * 10) / 10,
    energy: Math.round(energy * 100) / 100,
  };
});

export const reportAnomalies: ReportAnomalyBucket[] = [
  { type: '路径冲突', count: 612, percent: 33.2, color: '#3b82f6' },
  { type: '低电量', count: 428, percent: 23.2, color: '#f59e0b' },
  { type: '站点积压', count: 322, percent: 17.5, color: '#10b981' },
  { type: '设备故障', count: 276, percent: 15.0, color: '#a855f7' },
  { type: '抓取失败', count: 204, percent: 11.1, color: '#06b6d4' },
];

export const reportAnomalyTotal = reportAnomalies.reduce((sum, a) => sum + a.count, 0);

export const reportSceneRankings: ReportSceneRanking[] = [
  { rank: 1, scene: '电商仓', completionRate: 94.6, congestionRate: 11.2, energy: 0.76 },
  { rank: 2, scene: '冷链仓', completionRate: 92.1, congestionRate: 13.6, energy: 0.84 },
  { rank: 3, scene: '3C 仓', completionRate: 91.3, congestionRate: 15.1, energy: 0.87 },
  { rank: 4, scene: '医药仓', completionRate: 90.2, congestionRate: 13.4, energy: 0.81 },
];

export const reportFulfillment: FulfillmentDay[] = [
  { date: '05-01', onTime: 7842, delayed: 1012, unfinished: 146, fulfillmentRate: 88.4 },
  { date: '05-02', onTime: 8215, delayed: 986, unfinished: 103, fulfillmentRate: 89.1 },
  { date: '05-03', onTime: 8632, delayed: 1105, unfinished: 128, fulfillmentRate: 88.9 },
  { date: '05-04', onTime: 7993, delayed: 1114, unfinished: 112, fulfillmentRate: 87.8 },
  { date: '05-05', onTime: 8745, delayed: 1083, unfinished: 118, fulfillmentRate: 89.6 },
];

export const reportDeviceUsages: DeviceUsage[] = [
  { deviceId: 'AGV-001', type: 'AGV', utilization: 82.6, mileage: 632.5, tasks: 1248, faults: 2 },
  { deviceId: 'AGV-002', type: 'AGV', utilization: 79.4, mileage: 598.3, tasks: 1185, faults: 1 },
  { deviceId: 'AGV-003', type: 'AGV', utilization: 76.1, mileage: 571.7, tasks: 1076, faults: 3 },
  { deviceId: 'AGV-004', type: 'AGV', utilization: 74.8, mileage: 564.2, tasks: 1021, faults: 2 },
  { deviceId: 'AGV-005', type: 'AGV', utilization: 71.3, mileage: 538.6, tasks: 950, faults: 3 },
];

export const reportLogPlayback = {
  runId: 'RUN-20250528-104512',
  videoCover: 'playback-cover',
  events: [
    { time: '10:45:13', color: '#22c55e', label: '运行开始' },
    { time: '10:47:52', color: '#ef4444', label: '路径冲突告警 (#A12)' },
    { time: '10:50:18', color: '#f59e0b', label: '低电量告警 (AGV-003)' },
    { time: '10:52:41', color: '#a855f7', label: '站点积压 (P-07-01)' },
    { time: '10:55:33', color: '#22c55e', label: '故障恢复成功' },
    { time: '11:05:12', color: '#3b82f6', label: '运行结束' },
  ],
  totalDuration: '00:15:20',
  currentTime: '00:06:42',
};
