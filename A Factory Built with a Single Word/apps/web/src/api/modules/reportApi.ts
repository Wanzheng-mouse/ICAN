/**
 * 运行报告 API
 */

import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';

import type {
  DeviceUsage,
  FulfillmentDay,
  KpiCardData,
  ReportAnomalyBucket,
  ReportSceneRanking,
  ReportTrendPoint,
} from '@ican/contracts';

export interface ReportPlaybackFrame {
  time: number;
  tasks: { total: number; completed: number };
  metrics: Record<string, number>;
  robots: Array<{ id: string; state: string; x: number; y: number; battery: number }>;
}

export interface ReportLogPlayback {
  runId: string;
  frameCount: number;
  totalDuration: string;
  frames: ReportPlaybackFrame[];
  events: Array<{ time: string; color: string; label: string }>;
}

export async function getReportKpis(simulationId: string): Promise<KpiCardData[]> {
  return request({ url: apiUrl(`/reports/${simulationId}/kpis`) });
}
export async function getReportTrend(simulationId: string): Promise<ReportTrendPoint[]> {
  return request({ url: apiUrl(`/reports/${simulationId}/trend`) });
}
export async function getReportAnomalies(simulationId: string): Promise<ReportAnomalyBucket[]> {
  return request({ url: apiUrl(`/reports/${simulationId}/anomalies`) });
}
export async function getReportAnomalyTotal(simulationId: string): Promise<number> {
  return request({ url: apiUrl(`/reports/${simulationId}/anomaly-total`) });
}
export async function getReportSceneRankings(simulationId: string): Promise<ReportSceneRanking[]> {
  return request({ url: apiUrl(`/reports/${simulationId}/scene-rankings`) });
}
export async function getReportFulfillment(simulationId: string): Promise<FulfillmentDay[]> {
  return request({ url: apiUrl(`/reports/${simulationId}/fulfillment`) });
}
export async function getReportDeviceUsages(simulationId: string): Promise<DeviceUsage[]> {
  return request({ url: apiUrl(`/reports/${simulationId}/device-usages`) });
}
export async function getReportLogPlayback(simulationId: string): Promise<ReportLogPlayback> {
  return request({ url: apiUrl(`/reports/${simulationId}/log-playback`) });
}

// ===== React Hooks =====
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

type Hook<T> = (simulationId?: string) => UseQueryResult<T>;

export const useReportKpis: Hook<KpiCardData[]> =
  (id) => useQuery({ queryKey: ['report', id, 'kpis'], queryFn: () => getReportKpis(id!), enabled: Boolean(id) });
export const useReportTrend: Hook<ReportTrendPoint[]> =
  (id) => useQuery({ queryKey: ['report', id, 'trend'], queryFn: () => getReportTrend(id!), enabled: Boolean(id) });
export const useReportAnomalies: Hook<ReportAnomalyBucket[]> =
  (id) => useQuery({ queryKey: ['report', id, 'anomalies'], queryFn: () => getReportAnomalies(id!), enabled: Boolean(id) });
export const useReportAnomalyTotal: Hook<number> =
  (id) => useQuery({ queryKey: ['report', id, 'anomaly-total'], queryFn: () => getReportAnomalyTotal(id!), enabled: Boolean(id) });
export const useReportSceneRankings: Hook<ReportSceneRanking[]> =
  (id) => useQuery({ queryKey: ['report', id, 'rankings'], queryFn: () => getReportSceneRankings(id!), enabled: Boolean(id) });
export const useReportFulfillment: Hook<FulfillmentDay[]> =
  (id) => useQuery({ queryKey: ['report', id, 'fulfillment'], queryFn: () => getReportFulfillment(id!), enabled: Boolean(id) });
export const useReportDeviceUsages: Hook<DeviceUsage[]> =
  (id) => useQuery({ queryKey: ['report', id, 'devices'], queryFn: () => getReportDeviceUsages(id!), enabled: Boolean(id) });
export const useReportLogPlayback: Hook<ReportLogPlayback> =
  (id) => useQuery({ queryKey: ['report', id, 'playback'], queryFn: () => getReportLogPlayback(id!), enabled: Boolean(id) });

export async function downloadReportPdf(simulationId: string): Promise<Blob> {
  return request({ url: apiUrl(`/reports/${simulationId}/pdf`), responseType: 'blob' });
}
