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
import type { ScenarioCreate, ScenarioRead } from '@/api/dtos/backend';

export async function getScenario(id: string): Promise<SceneComponent[]> {
  if (USE_MOCK) return mockComponents;
  const read = await request<ScenarioRead>({ url: apiUrl(`/scenarios/${id}`) });
  return scenarioReadToComponents(read);
}

export async function saveScenario(id: string, components: SceneComponent[]): Promise<{ savedAt: string }> {
  if (USE_MOCK) return { savedAt: new Date().toISOString() };
  const payload = editorComponentsToScenarioUpdate(components);
  const saved = await request<ScenarioRead>({ url: apiUrl(`/scenarios/${id}`), method: 'PUT', data: payload });
  return { savedAt: saved.updated_at };
}

export async function createScenario(params: ScenarioCreate): Promise<ScenarioRead> {
  if (USE_MOCK) {
    return {
      id: `scn-${Date.now()}`,
      project_id: params.project_id,
      name: params.name,
      data: params.data ?? { components: [], canvas: { width: 1200, height: 800, scale: 1 }, schema_version: '1.0' },
      updated_at: new Date().toISOString(),
    };
  }
  return request({ url: apiUrl('/scenarios'), method: 'POST', data: params });
}

// ===== React Hooks =====
import { useMutation, useQuery, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';

export function useScenario(id: string): UseQueryResult<SceneComponent[]> {
  return useQuery({ queryKey: ['scenario', id], queryFn: () => getScenario(id), enabled: Boolean(id), staleTime: 60 * 1000 });
}

export function useSaveScenario(id: string): UseMutationResult<{ savedAt: string }, Error, SceneComponent[]> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SceneComponent[]) => saveScenario(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenario', id] }),
  });
}
