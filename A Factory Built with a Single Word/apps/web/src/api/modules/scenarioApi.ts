/**
 * 场景 API
 * 去掉写死的 /api/scenarios，改为 apiUrl + ID 参数。
 */

import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import { editorSceneComponents as mockComponents } from '@ican/mock-data';
import { scenarioReadToComponents, editorComponentsToScenarioUpdate } from '@/api/mappers/scenarioMapper';

import type { SceneComponent } from '@ican/contracts';
import type { ScenarioCreate } from '@/api/dtos/backend';

export async function getScenario(id: string): Promise<SceneComponent[]> {
  if (USE_MOCK) return mockComponents;
  const read = await request({ url: apiUrl(`/scenarios/${id}`) });
  return scenarioReadToComponents(read as any);
}

export async function saveScenario(id: string, components: SceneComponent[]): Promise<{ savedAt: string }> {
  if (USE_MOCK) return { savedAt: new Date().toISOString() };
  const payload = editorComponentsToScenarioUpdate(components);
  return request({ url: apiUrl(`/scenarios/${id}`), method: 'PUT', data: payload });
}

export async function createScenario(params: ScenarioCreate): Promise<{ id: string }> {
  if (USE_MOCK) return { id: `scn-${Date.now()}` };
  return request({ url: apiUrl('/scenarios'), method: 'POST', data: params });
}

// ===== React Hooks =====
import { useMutation, useQuery, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

export function useScenario(id: string): UseQueryResult<SceneComponent[]> {
  return useQuery({ queryKey: ['scenario', id], queryFn: () => getScenario(id), staleTime: 60 * 1000 });
}

export function useSaveScenario(id: string): UseMutationResult<{ savedAt: string }, Error, SceneComponent[]> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SceneComponent[]) => saveScenario(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenario', id] }),
  });
}
