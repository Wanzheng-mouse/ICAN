/**
 * 第三周场景 API
 *
 * 统一处理场景读取、校验、乐观锁保存、自动布局和版本历史。
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import { editorComponentsToScenarioUpdate } from '@/api/mappers/scenarioMapper';

import type { SceneComponent } from '@ican/contracts';
import type {
  ScenarioAutoLayoutRead,
  ScenarioCreate,
  ScenarioData,
  ScenarioRead,
  ScenarioValidationRead,
  ScenarioVersionRead,
} from '@/api/dtos/backend';

const DEFAULT_CANVAS = { width: 1200, height: 800, scale: 1 };

export class ScenarioValidationError extends Error {
  constructor(public readonly validation: ScenarioValidationRead) {
    super(validation.errors[0]?.message ?? '场景校验失败');
    this.name = 'ScenarioValidationError';
  }
}

export class ScenarioConflictError extends Error {
  constructor(public readonly currentVersion?: number) {
    super('场景已被其他会话更新，请重新加载后再保存');
    this.name = 'ScenarioConflictError';
  }
}

function buildData(components: SceneComponent[], canvas: ScenarioData['canvas'] = DEFAULT_CANVAS): ScenarioData {
  return { components, canvas, schema_version: '1.0' };
}

function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export async function getScenario(id: string): Promise<ScenarioRead> {
  return request({ url: apiUrl('/scenarios/' + id) });
}

export async function validateScenario(id: string, components: SceneComponent[], canvas: ScenarioData['canvas'] = DEFAULT_CANVAS): Promise<ScenarioValidationRead> {
  const data = buildData(components, canvas);
  return request({
    url: apiUrl('/scenarios/' + id + '/validate'),
    method: 'POST',
    data: { data },
  });
}

export async function saveScenario(
  id: string,
  components: SceneComponent[],
  expectedVersion?: number,
  canvas: ScenarioData['canvas'] = DEFAULT_CANVAS,
): Promise<ScenarioRead> {
  const validation = await validateScenario(id, components, canvas);
  if (!validation.valid) throw new ScenarioValidationError(validation);

  const payload = editorComponentsToScenarioUpdate(components, canvas, expectedVersion);
  try {
    return await request({ url: apiUrl('/scenarios/' + id), method: 'PUT', data: payload });
  } catch (error: unknown) {
    if (getErrorStatus(error) === 409) {
      const currentVersion = Number((error as { response?: { data?: { current_version?: unknown } } })?.response?.data?.current_version);
      throw new ScenarioConflictError(Number.isFinite(currentVersion) ? currentVersion : undefined);
    }
    throw error;
  }
}

export async function autoLayoutScenario(id: string, components: SceneComponent[], canvas: ScenarioData['canvas'] = DEFAULT_CANVAS): Promise<ScenarioAutoLayoutRead> {
  const data = buildData(components, canvas);
  return request({
    url: apiUrl('/scenarios/' + id + '/auto-layout'),
    method: 'POST',
    data: { data },
  });
}

export async function getScenarioVersions(id: string): Promise<ScenarioVersionRead[]> {
  return request({ url: apiUrl('/scenarios/' + id + '/versions') });
}

export async function createScenario(params: ScenarioCreate): Promise<ScenarioRead> {
  return request({ url: apiUrl('/scenarios'), method: 'POST', data: params });
}

export interface ScenarioSaveInput {
  components: SceneComponent[];
  canvas?: ScenarioData['canvas'];
  expectedVersion?: number;
}

export interface ScenarioLayoutInput {
  components: SceneComponent[];
  canvas?: ScenarioData['canvas'];
}

export function useScenario(id: string): UseQueryResult<ScenarioRead> {
  return useQuery({
    queryKey: ['scenario', id],
    queryFn: () => getScenario(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

export function useSaveScenario(id: string): UseMutationResult<ScenarioRead, Error, ScenarioSaveInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ components, canvas, expectedVersion }) => saveScenario(id, components, expectedVersion, canvas),
    onSuccess: (saved) => {
      queryClient.setQueryData(['scenario', id], saved);
      queryClient.invalidateQueries({ queryKey: ['scenario', id, 'versions'] });
    },
  });
}

export function useAutoLayoutScenario(id: string): UseMutationResult<ScenarioAutoLayoutRead, Error, ScenarioLayoutInput> {
  return useMutation({ mutationFn: ({ components, canvas }) => autoLayoutScenario(id, components, canvas) });
}

export function useScenarioVersions(id: string): UseQueryResult<ScenarioVersionRead[]> {
  return useQuery({
    queryKey: ['scenario', id, 'versions'],
    queryFn: () => getScenarioVersions(id),
    enabled: Boolean(id),
  });
}
