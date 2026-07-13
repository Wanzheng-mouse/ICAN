/**
 * 资源中心 API（带 React Hooks 封装）
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import {
  featuredCases as mockFeaturedCases,
  hotResources as mockHotResources,
  learningPath as mockLearningPath,
  resourceCategories as mockCategories,
  scenarioTemplates as mockTemplates,
} from '@ican/mock-data';

import type {
  FeaturedCase,
  HotResource,
  LearningPathStep,
  ResourceCategory,
  SceneTemplate,
} from '@ican/contracts';

export async function getFeaturedCases(): Promise<FeaturedCase[]> {
  if (USE_MOCK) return mockFeaturedCases;
  return request({ url: '/api/resource/featured-cases' });
}
export async function getHotResources(): Promise<HotResource[]> {
  if (USE_MOCK) return mockHotResources;
  return request({ url: '/api/resource/hot-resources' });
}
export async function getLearningPath(): Promise<LearningPathStep[]> {
  if (USE_MOCK) return mockLearningPath;
  return request({ url: '/api/resource/learning-path' });
}
export async function getResourceCategories(): Promise<ResourceCategory[]> {
  if (USE_MOCK) return mockCategories;
  return request({ url: '/api/resource/categories' });
}
export async function getResourceTemplates(): Promise<SceneTemplate[]> {
  if (USE_MOCK) return mockTemplates;
  return request({ url: '/api/resource/templates' });
}

export function useFeaturedCases(): UseQueryResult<FeaturedCase[]> {
  return useQuery({ queryKey: ['resource', 'featured'], queryFn: getFeaturedCases });
}
export function useHotResources(): UseQueryResult<HotResource[]> {
  return useQuery({ queryKey: ['resource', 'hot'], queryFn: getHotResources });
}
export function useLearningPath(): UseQueryResult<LearningPathStep[]> {
  return useQuery({ queryKey: ['resource', 'learning'], queryFn: getLearningPath });
}
export function useResourceCategories(): UseQueryResult<ResourceCategory[]> {
  return useQuery({ queryKey: ['resource', 'categories'], queryFn: getResourceCategories });
}
export function useResourceTemplates(): UseQueryResult<SceneTemplate[]> {
  return useQuery({ queryKey: ['resource', 'templates'], queryFn: getResourceTemplates });
}
