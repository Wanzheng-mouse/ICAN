/**
 * Mapper: ScenarioRead ↔ SceneComponent[]
 *
 * 后端 ScenarioRead.data.components 是原始 JSON，
 * 前端编辑器使用 SceneComponent[] 数组。
 * 映射只在数据进出 API 边界时执行，页面本身不感知字段差异。
 */
import type { ScenarioRead, ScenarioCreate, ScenarioUpdate } from '@/api/dtos/backend';
import type { SceneComponent } from '@ican/contracts';

/** 后端 ScenarioRead → 前端 SceneComponent[] */
export function scenarioReadToComponents(read: ScenarioRead): SceneComponent[] {
  const components = read.data?.components as SceneComponent[] | undefined;
  return components ?? [];
}

/** 后端 ScenarioRead → 前端 canvas 尺寸 */
export function scenarioReadToCanvas(read: ScenarioRead): { width: number; height: number; scale: number } {
  const c = read.data?.canvas as { width?: number; height?: number; scale?: number } | undefined;
  return { width: c?.width ?? 1200, height: c?.height ?? 800, scale: c?.scale ?? 1 };
}

/** 前端 SceneComponent[] + canvas → 后端 ScenarioUpdate */
export function editorComponentsToScenarioUpdate(
  components: SceneComponent[],
  canvas?: { width: number; height: number; scale: number },
): ScenarioUpdate {
  return {
    data: {
      components,
      canvas: canvas ?? { width: 1200, height: 800, scale: 1 },
      schema_version: '1.0',
    },
  };
}

/** 前端 SceneComponent[] + canvas → 后端 ScenarioCreate */
export function editorComponentsToScenarioCreate(
  projectId: string,
  name: string,
  components: SceneComponent[],
  canvas?: { width: number; height: number; scale: number },
): ScenarioCreate {
  return {
    project_id: projectId,
    name,
    data: {
      components,
      canvas: canvas ?? { width: 1200, height: 800, scale: 1 },
      schema_version: '1.0',
    },
  };
}
