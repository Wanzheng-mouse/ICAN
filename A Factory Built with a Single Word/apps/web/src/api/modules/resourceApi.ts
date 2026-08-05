/**
 * 资源中心 API
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';

import type { FeaturedCase, HotResource, LearningPathStep, ResourceCategory, SceneTemplate } from '@ican/contracts';

export async function getFeaturedCases(): Promise<FeaturedCase[]> {
  return request({ url: apiUrl('/resource/featured-cases') });
}
export async function getHotResources(): Promise<HotResource[]> {
  return request({ url: apiUrl('/resource/hot-resources') });
}
export async function getLearningPath(): Promise<LearningPathStep[]> {
  return request({ url: apiUrl('/resource/learning-path') });
}
export async function getResourceCategories(): Promise<ResourceCategory[]> {
  return request({ url: apiUrl('/resource/categories') });
}
export async function getResourceTemplates(): Promise<SceneTemplate[]> {
  return request({ url: apiUrl('/resource/templates') });
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
