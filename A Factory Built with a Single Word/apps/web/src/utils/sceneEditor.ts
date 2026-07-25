import type { SceneComponent } from '@ican/contracts';
import type { ScenarioData, ScenarioValidationIssue, ScenarioValidationRead } from '@/api/dtos/backend';

export const DEFAULT_SCENARIO_CANVAS: ScenarioData['canvas'] = { width: 1200, height: 800, scale: 1 };

const DEFAULT_SIZE: Record<SceneComponent['type'], { width: number; height: number }> = {
  shelf: { width: 180, height: 64 },
  agv: { width: 36, height: 26 },
  arm: { width: 52, height: 52 },
  conveyor: { width: 160, height: 44 },
  station: { width: 92, height: 62 },
  charger: { width: 42, height: 42 },
  obstacle: { width: 120, height: 36 },
};

export function cloneComponents(components: SceneComponent[]): SceneComponent[] {
  return components.map((component) => ({
    ...component,
    properties: { ...component.properties },
  }));
}

export function clampComponentToCanvas(
  component: SceneComponent,
  canvas: ScenarioData['canvas'],
  position: Pick<SceneComponent, 'x' | 'y'>,
): Pick<SceneComponent, 'x' | 'y'> {
  return {
    x: Math.max(0, Math.min(Math.round(position.x), Math.max(0, canvas.width - component.width))),
    y: Math.max(0, Math.min(Math.round(position.y), Math.max(0, canvas.height - component.height))),
  };
}

function overlaps(left: SceneComponent, right: SceneComponent, gap = 0): boolean {
  return left.x < right.x + right.width + gap &&
    left.x + left.width + gap > right.x &&
    left.y < right.y + right.height + gap &&
    left.y + left.height + gap > right.y;
}

export function createSceneComponent(
  type: SceneComponent['type'],
  name: string,
  existing: SceneComponent[],
  canvas: ScenarioData['canvas'],
  customSize?: { width: number; height: number },
): SceneComponent {
  const size = customSize ?? DEFAULT_SIZE[type];
  let position = { x: 24, y: 24 };
  let found = false;
  for (let y = 24; y + size.height <= canvas.height - 24 && !found; y += 28) {
    for (let x = 24; x + size.width <= canvas.width - 24; x += 28) {
      const candidate: SceneComponent = {
        id: 'candidate', type, name, x, y, ...size, rotation: 0, properties: {},
      };
      if (!existing.some((component) => overlaps(candidate, component, 8))) {
        position = { x, y };
        found = true;
        break;
      }
    }
  }
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id: `${type}-${suffix}`,
    type,
    name,
    ...position,
    ...size,
    rotation: 0,
    properties: type === 'shelf' ? { capacity: 200 } : type === 'agv' ? { battery: 100 } : {},
  };
}

export function validateSceneLocally(
  components: SceneComponent[],
  canvas: ScenarioData['canvas'],
): ScenarioValidationRead {
  const errors: ScenarioValidationIssue[] = [];
  const warnings: ScenarioValidationIssue[] = [];
  const ids = new Set<string>();

  if (canvas.width <= 0 || canvas.height <= 0 || canvas.scale <= 0) {
    errors.push({ code: 'CANVAS_INVALID', message: '画布尺寸和比例必须大于 0', component_ids: [], field: 'canvas' });
  }

  components.forEach((component, index) => {
    if (!component.id.trim() || ids.has(component.id)) {
      errors.push({ code: 'DUPLICATE_COMPONENT_ID', message: `组件 ID ${component.id || '（空）'} 无效或重复`, component_ids: [component.id], field: 'components.id' });
    }
    ids.add(component.id);
    if (!component.name.trim()) {
      errors.push({ code: 'COMPONENT_NAME_EMPTY', message: `组件 ${component.id} 名称不能为空`, component_ids: [component.id], field: 'components.name' });
    }
    if (component.width <= 0 || component.height <= 0) {
      errors.push({ code: 'COMPONENT_SIZE_INVALID', message: `组件 ${component.name} 尺寸必须大于 0`, component_ids: [component.id], field: 'components.size' });
    }
    if (component.x < 0 || component.y < 0 || component.x + component.width > canvas.width || component.y + component.height > canvas.height) {
      errors.push({ code: 'OUT_OF_BOUNDS', message: `组件 ${component.name} 超出画布边界`, component_ids: [component.id], field: 'components.position' });
    }
    components.slice(index + 1).forEach((other) => {
      if (overlaps(component, other)) {
        errors.push({ code: 'COMPONENT_OVERLAP', message: `组件 ${component.name} 与 ${other.name} 发生重叠`, component_ids: [component.id, other.id], field: 'components.position' });
      }
    });
  });

  if (!components.length) {
    warnings.push({ code: 'EMPTY_SCENARIO', message: '场景中暂无组件，可从左侧组件库添加', component_ids: [], field: 'components' });
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function sceneOverview(components: SceneComponent[], canvas: ScenarioData['canvas']) {
  const canvasArea = Math.max(1, canvas.width * canvas.height);
  const occupiedArea = components.reduce((total, component) => total + component.width * component.height, 0);
  return {
    shelves: components.filter((component) => component.type === 'shelf').length,
    agvs: components.filter((component) => component.type === 'agv').length,
    arms: components.filter((component) => component.type === 'arm').length,
    stations: components.filter((component) => component.type === 'station').length,
    occupiedArea: Math.round(occupiedArea),
    passableRate: Math.max(0, Math.round((1 - occupiedArea / canvasArea) * 1000) / 10),
  };
}

export function isFormInteractionTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], .ant-select'));
}
