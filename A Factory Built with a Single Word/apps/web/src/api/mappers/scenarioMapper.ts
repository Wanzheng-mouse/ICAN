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
  return read.data.components;
}

/** 后端 ScenarioRead → 前端 canvas 尺寸 */
export function scenarioReadToCanvas(read: ScenarioRead): { width: number; height: number; scale: number } {
  const { canvas } = read.data;
  return { width: canvas.width, height: canvas.height, scale: canvas.scale };
}

/** 前端 SceneComponent[] + canvas → 后端 ScenarioUpdate */
export function editorComponentsToScenarioUpdate(
  components: SceneComponent[],
  canvas?: { width: number; height: number; scale: number },
  expectedVersion?: number,
): ScenarioUpdate {
  return {
    data: {
      components,
      canvas: canvas ?? { width: 1200, height: 800, scale: 1 },
      schema_version: '1.0',
    },
    expected_version: expectedVersion,
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

/** 后端 ScenarioRead → 前端编辑器初始化状态 */
export function scenarioReadToEditorState(read: ScenarioRead): {
  components: SceneComponent[];
  canvas: { width: number; height: number; scale: number };
  name: string;
  version: number;
} {
  return {
    components: scenarioReadToComponents(read),
    canvas: scenarioReadToCanvas(read),
    name: read.name,
    version: read.version,
  };
}
