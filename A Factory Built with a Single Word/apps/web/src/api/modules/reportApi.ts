/**
 * 运行报告 API
 *
 * Mock 模式：直接返回本地数据
 * 真实模式：向后端 /api/v1/reports/{simulationId}/* 发起 REST
 */

import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import {
  reportKpis as mockKpis,
  reportTrend as mockTrend,
  reportAnomalies as mockAnomalies,
  reportAnomalyTotal as mockAnomalyTotal,
  reportSceneRankings as mockRankings,
  reportFulfillment as mockFulfillment,
  reportDeviceUsages as mockDevices,
  reportLogPlayback as mockPlayback,
} from '@ican/mock-data';

import type {
  DeviceUsage,
  FulfillmentDay,
  KpiCardData,
  ReportAnomalyBucket,
  ReportSceneRanking,
  ReportTrendPoint,
} from '@ican/contracts';

export async function getReportKpis(simulationId: string): Promise<KpiCardData[]> {
  if (USE_MOCK) return mockKpis;
  return request({ url: apiUrl(`/reports/${simulationId}/kpis`) });
}
export async function getReportTrend(simulationId: string): Promise<ReportTrendPoint[]> {
  if (USE_MOCK) return mockTrend;
  return request({ url: apiUrl(`/reports/${simulationId}/trend`) });
}
export async function getReportAnomalies(simulationId: string): Promise<ReportAnomalyBucket[]> {
  if (USE_MOCK) return mockAnomalies;
  return request({ url: apiUrl(`/reports/${simulationId}/anomalies`) });
}
export async function getReportAnomalyTotal(simulationId: string): Promise<number> {
  if (USE_MOCK) return mockAnomalyTotal;
  return request({ url: apiUrl(`/reports/${simulationId}/anomaly-total`) });
}
export async function getReportSceneRankings(simulationId: string): Promise<ReportSceneRanking[]> {
  if (USE_MOCK) return mockRankings;
  return request({ url: apiUrl(`/reports/${simulationId}/scene-rankings`) });
}
export async function getReportFulfillment(simulationId: string): Promise<FulfillmentDay[]> {
  if (USE_MOCK) return mockFulfillment;
  return request({ url: apiUrl(`/reports/${simulationId}/fulfillment`) });
}
export async function getReportDeviceUsages(simulationId: string): Promise<DeviceUsage[]> {
  if (USE_MOCK) return mockDevices;
  return request({ url: apiUrl(`/reports/${simulationId}/device-usages`) });
}
export async function getReportLogPlayback(simulationId: string): Promise<typeof mockPlayback> {
  if (USE_MOCK) return mockPlayback;
  return request({ url: apiUrl(`/reports/${simulationId}/log-playback`) });
}

// ===== React Hooks =====
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

type Hook<T> = (simulationId?: string) => UseQueryResult<T>;

export const useReportKpis: Hook<KpiCardData[]> =
  (id) => useQuery({ queryKey: ['report', id ?? 'mock', 'kpis'], queryFn: () => getReportKpis(id ?? 'mock') });
export const useReportTrend: Hook<ReportTrendPoint[]> =
  (id) => useQuery({ queryKey: ['report', id ?? 'mock', 'trend'], queryFn: () => getReportTrend(id ?? 'mock') });
export const useReportAnomalies: Hook<ReportAnomalyBucket[]> =
  (id) => useQuery({ queryKey: ['report', id ?? 'mock', 'anomalies'], queryFn: () => getReportAnomalies(id ?? 'mock') });
export const useReportAnomalyTotal: Hook<number> =
  (id) => useQuery({ queryKey: ['report', id ?? 'mock', 'anomaly-total'], queryFn: () => getReportAnomalyTotal(id ?? 'mock') });
export const useReportSceneRankings: Hook<ReportSceneRanking[]> =
  (id) => useQuery({ queryKey: ['report', id ?? 'mock', 'rankings'], queryFn: () => getReportSceneRankings(id ?? 'mock') });
export const useReportFulfillment: Hook<FulfillmentDay[]> =
  (id) => useQuery({ queryKey: ['report', id ?? 'mock', 'fulfillment'], queryFn: () => getReportFulfillment(id ?? 'mock') });
export const useReportDeviceUsages: Hook<DeviceUsage[]> =
  (id) => useQuery({ queryKey: ['report', id ?? 'mock', 'devices'], queryFn: () => getReportDeviceUsages(id ?? 'mock') });
export const useReportLogPlayback: Hook<typeof mockPlayback> =
  (id) => useQuery({ queryKey: ['report', id ?? 'mock', 'playback'], queryFn: () => getReportLogPlayback(id ?? 'mock') });
