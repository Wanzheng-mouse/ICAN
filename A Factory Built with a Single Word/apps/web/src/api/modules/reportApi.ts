/**
 * 报告 API（带 React Hooks 封装）
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import {
  reportKpis as mockKpis,
  reportTrend as mockTrend,
  reportAnomalies as mockAnomalies,
  reportSceneRankings as mockRankings,
  reportFulfillment as mockFulfillment,
  reportDeviceUsages as mockDevices,
  reportLogPlayback as mockPlayback,
  reportAnomalyTotal as mockAnomalyTotal,
} from '@ican/mock-data';

import type {
  DeviceUsage,
  FulfillmentDay,
  KpiCardData,
  ReportAnomalyBucket,
  ReportSceneRanking,
  ReportTrendPoint,
} from '@ican/contracts';

export async function getReportKpis(): Promise<KpiCardData[]> {
  if (USE_MOCK) return mockKpis;
  return request({ url: '/api/reports/current/kpis' });
}
export async function getReportTrend(): Promise<ReportTrendPoint[]> {
  if (USE_MOCK) return mockTrend;
  return request({ url: '/api/reports/current/trend' });
}
export async function getReportAnomalies(): Promise<ReportAnomalyBucket[]> {
  if (USE_MOCK) return mockAnomalies;
  return request({ url: '/api/reports/current/anomalies' });
}
export async function getReportAnomalyTotal(): Promise<number> {
  if (USE_MOCK) return mockAnomalyTotal;
  return request({ url: '/api/reports/current/anomaly-total' });
}
export async function getReportSceneRankings(): Promise<ReportSceneRanking[]> {
  if (USE_MOCK) return mockRankings;
  return request({ url: '/api/reports/current/scene-rankings' });
}
export async function getReportFulfillment(): Promise<FulfillmentDay[]> {
  if (USE_MOCK) return mockFulfillment;
  return request({ url: '/api/reports/current/fulfillment' });
}
export async function getReportDeviceUsages(): Promise<DeviceUsage[]> {
  if (USE_MOCK) return mockDevices;
  return request({ url: '/api/reports/current/device-usages' });
}
export async function getReportLogPlayback(): Promise<typeof mockPlayback> {
  if (USE_MOCK) return mockPlayback;
  return request({ url: '/api/reports/current/log-playback' });
}

export function useReportKpis(): UseQueryResult<KpiCardData[]> {
  return useQuery({ queryKey: ['report', 'kpis'], queryFn: getReportKpis });
}
export function useReportTrend(): UseQueryResult<ReportTrendPoint[]> {
  return useQuery({ queryKey: ['report', 'trend'], queryFn: getReportTrend });
}
export function useReportAnomalies(): UseQueryResult<ReportAnomalyBucket[]> {
  return useQuery({ queryKey: ['report', 'anomalies'], queryFn: getReportAnomalies });
}
export function useReportAnomalyTotal(): UseQueryResult<number> {
  return useQuery({ queryKey: ['report', 'anomaly-total'], queryFn: getReportAnomalyTotal });
}
export function useReportSceneRankings(): UseQueryResult<ReportSceneRanking[]> {
  return useQuery({ queryKey: ['report', 'rankings'], queryFn: getReportSceneRankings });
}
export function useReportFulfillment(): UseQueryResult<FulfillmentDay[]> {
  return useQuery({ queryKey: ['report', 'fulfillment'], queryFn: getReportFulfillment });
}
export function useReportDeviceUsages(): UseQueryResult<DeviceUsage[]> {
  return useQuery({ queryKey: ['report', 'devices'], queryFn: getReportDeviceUsages });
}
export function useReportLogPlayback(): UseQueryResult<typeof mockPlayback> {
  return useQuery({ queryKey: ['report', 'playback'], queryFn: getReportLogPlayback });
}
