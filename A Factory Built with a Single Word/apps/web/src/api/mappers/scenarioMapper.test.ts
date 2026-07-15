import { describe, expect, it } from 'vitest';
import type { SceneComponent } from '@ican/contracts';
import type { ScenarioRead } from '@/api/dtos/backend';
import {
  editorComponentsToScenarioCreate,
  editorComponentsToScenarioUpdate,
  scenarioReadToCanvas,
  scenarioReadToComponents,
} from './scenarioMapper';

const components: SceneComponent[] = [
  {
    id: 'shelf-1',
    type: 'shelf',
    name: 'Shelf 1',
    x: 20,
    y: 30,
    width: 120,
    height: 60,
    rotation: 0,
    properties: { capacity: 200 },
  },
];

describe('场景 Mapper', () => {
  it('将 ScenarioRead 稳定映射为编辑器组件和画布', () => {
    const read: ScenarioRead = {
      id: 'scenario-1',
      project_id: 'project-1',
      name: 'Warehouse',
      data: {
        components,
        canvas: { width: 900, height: 600, scale: 1.25 },
        schema_version: '1.0',
      },
      version: 3,
      updated_at: '2026-07-15T10:00:00',
    };

    expect(scenarioReadToComponents(read)).toEqual(components);
    expect(scenarioReadToCanvas(read)).toEqual({ width: 900, height: 600, scale: 1.25 });
  });

  it('保存 Mapper 携带统一 data 和 expected_version', () => {
    const update = editorComponentsToScenarioUpdate(
      components,
      { width: 900, height: 600, scale: 1 },
      3,
    );

    expect(update.data.components).toEqual(components);
    expect(update.data.schema_version).toBe('1.0');
    expect(update.expected_version).toBe(3);
  });

  it('创建 Mapper 产生可直接提交的 ScenarioCreate', () => {
    const create = editorComponentsToScenarioCreate('project-1', 'Warehouse', components);
    expect(create.project_id).toBe('project-1');
    expect(create.data?.components).toEqual(components);
    expect(create.data?.schema_version).toBe('1.0');
  });
});