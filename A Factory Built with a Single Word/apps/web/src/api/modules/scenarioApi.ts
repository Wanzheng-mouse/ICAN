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
import { request, USE_MOCK } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import { editorSceneComponents as mockComponents } from '@ican/mock-data';
import { editorComponentsToScenarioUpdate } from '@/api/mappers/scenarioMapper';

import type { SceneComponent } from '@ican/contracts';
import type {
  ScenarioAutoLayoutRead,
  ScenarioCreate,
  ScenarioData,
  ScenarioRead,
  ScenarioValidationIssue,
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
  constructor() {
    super('场景已被其他会话更新，请重新加载后再保存');
    this.name = 'ScenarioConflictError';
  }
}

function buildData(components: SceneComponent[], canvas: ScenarioData['canvas'] = DEFAULT_CANVAS): ScenarioData {
  return { components, canvas, schema_version: '1.0' };
}

function validateMockData(data: ScenarioData): ScenarioValidationRead {
  const errors: ScenarioValidationIssue[] = [];
  const seen = new Set<string>();

  data.components.forEach((component, index) => {
    if (seen.has(component.id)) {
      errors.push({
        code: 'DUPLICATE_COMPONENT_ID',
        message: '组件 ID ' + component.id + ' 重复',
        component_ids: [component.id],
        field: 'components.id',
      });
    }
    seen.add(component.id);

    if (
      component.x < 0
      || component.y < 0
      || component.x + component.width > data.canvas.width
      || component.y + component.height > data.canvas.height
    ) {
      errors.push({
        code: 'OUT_OF_BOUNDS',
        message: '组件 ' + component.name + ' 超出画布边界',
        component_ids: [component.id],
        field: 'components.position',
      });
    }

    data.components.slice(index + 1).forEach((other) => {
      const overlaps = (
        component.x < other.x + other.width
        && component.x + component.width > other.x
        && component.y < other.y + other.height
        && component.y + component.height > other.y
      );
      if (overlaps) {
        errors.push({
          code: 'COMPONENT_OVERLAP',
          message: '组件 ' + component.name + ' 与 ' + other.name + ' 发生重叠',
          component_ids: [component.id, other.id],
          field: 'components.position',
        });
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings: data.components.length === 0
      ? [{ code: 'EMPTY_SCENARIO', message: '场景中暂无组件', component_ids: [], field: 'components' }]
      : [],
  };
}

function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export async function getScenario(id: string): Promise<ScenarioRead> {
  if (USE_MOCK) {
    return {
      id,
      project_id: 'mock-project',
      name: 'Mock warehouse',
      data: buildData(mockComponents),
      version: 1,
      updated_at: new Date().toISOString(),
    };
  }
  return request({ url: apiUrl('/scenarios/' + id) });
}

export async function validateScenario(id: string, components: SceneComponent[], canvas: ScenarioData['canvas'] = DEFAULT_CANVAS): Promise<ScenarioValidationRead> {
  const data = buildData(components, canvas);
  if (USE_MOCK) return validateMockData(data);
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
  if (USE_MOCK) {
    return {
      id,
      project_id: 'mock-project',
      name: 'Mock warehouse',
      data: payload.data,
      version: (expectedVersion ?? 1) + 1,
      updated_at: new Date().toISOString(),
    };
  }

  try {
    return await request({ url: apiUrl('/scenarios/' + id), method: 'PUT', data: payload });
  } catch (error: unknown) {
    if (getErrorStatus(error) === 409) throw new ScenarioConflictError();
    throw error;
  }
}

export async function autoLayoutScenario(id: string, components: SceneComponent[], canvas: ScenarioData['canvas'] = DEFAULT_CANVAS): Promise<ScenarioAutoLayoutRead> {
  const data = buildData(components, canvas);
  if (USE_MOCK) {
    let cursorX = 24;
    let cursorY = 24;
    let rowHeight = 0;
    const laidOut = components.map((component) => {
      if (cursorX + component.width > data.canvas.width - 24) {
        cursorX = 24;
        cursorY += rowHeight + 24;
        rowHeight = 0;
      }
      const result = { ...component, x: cursorX, y: cursorY };
      cursorX += component.width + 24;
      rowHeight = Math.max(rowHeight, component.height);
      return result;
    });
    const resultData = buildData(laidOut);
    return { data: resultData, validation: validateMockData(resultData) };
  }

  return request({
    url: apiUrl('/scenarios/' + id + '/auto-layout'),
    method: 'POST',
    data: { data },
  });
}

export async function getScenarioVersions(id: string): Promise<ScenarioVersionRead[]> {
  if (USE_MOCK) {
    const scenario = await getScenario(id);
    return [{
      id: 'mock-version-1',
      scenario_id: id,
      version: scenario.version,
      name: scenario.name,
      data: scenario.data,
      created_at: scenario.updated_at,
    }];
  }
  return request({ url: apiUrl('/scenarios/' + id + '/versions') });
}

export async function createScenario(params: ScenarioCreate): Promise<ScenarioRead> {
  if (USE_MOCK) {
    return {
      id: 'scn-' + Date.now(),
      project_id: params.project_id,
      name: params.name,
      data: params.data ?? buildData([]),
      version: 1,
      updated_at: new Date().toISOString(),
    };
  }
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