/**
 * 场景 API（带 React Hooks 封装）
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import { editorSceneComponents as mockComponents } from '@ican/mock-data';

import type { SceneComponent } from '@ican/contracts';

export async function getScenario(id: string): Promise<SceneComponent[]> {
  if (USE_MOCK) return mockComponents;
  return request({ url: `/api/scenarios/${id}` });
}

export async function saveScenario(id: string, data: SceneComponent[]): Promise<{ savedAt: string }> {
  if (USE_MOCK) return { savedAt: new Date().toISOString() };
  return request({ url: `/api/scenarios/${id}`, method: 'PUT', data });
}

export function useScenario(id: string): UseQueryResult<SceneComponent[]> {
  return useQuery({
    queryKey: ['scenario', id],
    queryFn: () => getScenario(id),
    staleTime: 60 * 1000,
  });
}

export function useSaveScenario(id: string): UseMutationResult<{ savedAt: string }, Error, SceneComponent[]> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SceneComponent[]) => saveScenario(id, data),
    onSuccess: (result) => {
      qc.setQueryData(['scenario', id, 'meta'], result);
      qc.invalidateQueries({ queryKey: ['scenario', id] });
    },
  });
}
