/**
 * 场景编辑器组件 CRUD 单元测试
 * 验证组件的添加、删除、修改、撤销/重做逻辑
 */
import { describe, expect, it } from 'vitest';
import type { SceneComponent } from '@ican/contracts';

const HISTORY_LIMIT = 30;

/**
 * 场景编辑器的纯函数实现
 * 与 Editor 页面的状态管理逻辑保持一致
 */
function createSceneEditor(initial: SceneComponent[]) {
  let components: SceneComponent[] = [...initial];
  let past: SceneComponent[][] = [];
  let future: SceneComponent[][] = [];
  let selectedId: string | null = null;

  const pushHistory = () => {
    past = [...past, components];
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
  };

  const add = (comp: SceneComponent) => {
    pushHistory();
    components = [...components, comp];
    selectedId = comp.id;
  };

  const remove = (id: string) => {
    if (!components.find((c) => c.id === id)) return;
    pushHistory();
    components = components.filter((c) => c.id !== id);
    if (selectedId === id) selectedId = null;
  };

  const update = (id: string, patch: Partial<SceneComponent>) => {
    if (!components.find((c) => c.id === id)) return;
    pushHistory();
    components = components.map((c) => (c.id === id ? { ...c, ...patch } : c));
  };

  const rotate = (id: string) => {
    const c = components.find((x) => x.id === id);
    if (!c) return;
    update(id, { rotation: (c.rotation + 90) % 360 });
  };

  const align = (id: string, axis: 'left' | 'right' | 'center-h' | 'top' | 'bottom' | 'center-v', canvasW = 1200, canvasH = 700) => {
    const c = components.find((x) => x.id === id);
    if (!c) return;
    let patch: Partial<SceneComponent> = {};
    switch (axis) {
      case 'left': patch = { x: 0 }; break;
      case 'right': patch = { x: canvasW - c.width }; break;
      case 'center-h': patch = { x: Math.round((canvasW - c.width) / 2) }; break;
      case 'top': patch = { y: 0 }; break;
      case 'bottom': patch = { y: canvasH - c.height }; break;
      case 'center-v': patch = { y: Math.round((canvasH - c.height) / 2) }; break;
    }
    update(id, patch);
  };

  const undo = () => {
    if (past.length === 0) return false;
    const prev = past[past.length - 1];
    future = [components, ...future];
    components = prev;
    past = past.slice(0, -1);
    return true;
  };

  const redo = () => {
    if (future.length === 0) return false;
    const next = future[0];
    past = [...past, components];
    components = next;
    future = future.slice(1);
    return true;
  };

  return {
    add,
    remove,
    update,
    rotate,
    align,
    undo,
    redo,
    snapshot: () => ({
      components: [...components],
      selectedId,
      historyLength: past.length,
      futureLength: future.length,
    }),
  };
}

const sampleComponents: SceneComponent[] = [
  { id: 'a', type: 'shelf', name: 'A-01', x: 0, y: 0, width: 100, height: 50, rotation: 0, properties: {} },
  { id: 'b', type: 'shelf', name: 'A-02', x: 200, y: 0, width: 100, height: 50, rotation: 0, properties: {} },
  { id: 'c', type: 'agv', name: 'AGV-01', x: 50, y: 100, width: 24, height: 16, rotation: 0, properties: {} },
];

describe('场景编辑器 CRUD', () => {
  it('add 推入历史且选中新增项', () => {
    const e = createSceneEditor(sampleComponents);
    e.add({ id: 'd', type: 'shelf', name: 'A-03', x: 400, y: 0, width: 100, height: 50, rotation: 0, properties: {} });
    const s = e.snapshot();
    expect(s.components).toHaveLength(4);
    expect(s.selectedId).toBe('d');
    expect(s.historyLength).toBe(1);
  });

  it('remove 推入历史且如删选中则清空', () => {
    const e = createSceneEditor(sampleComponents);
    e.remove('a');
    const s = e.snapshot();
    expect(s.components).toHaveLength(2);
    expect(s.selectedId).toBeNull();
    expect(s.historyLength).toBe(1);
  });

  it('update 推入历史且保留 selectedId', () => {
    const e = createSceneEditor(sampleComponents);
    e.update('a', { x: 999 });
    const s = e.snapshot();
    expect(s.components.find((c) => c.id === 'a')?.x).toBe(999);
    expect(s.historyLength).toBe(1);
  });

  it('rotate +90°', () => {
    const e = createSceneEditor(sampleComponents);
    e.rotate('a');
    expect(e.snapshot().components.find((c) => c.id === 'a')?.rotation).toBe(90);
  });

  it('rotate 360° 循环', () => {
    const e = createSceneEditor([{ ...sampleComponents[0], rotation: 270 }]);
    e.rotate('a');
    expect(e.snapshot().components.find((c) => c.id === 'a')?.rotation).toBe(0);
  });

  it('align 6 个方向', () => {
    const e = createSceneEditor(sampleComponents);
    e.align('a', 'left');
    expect(e.snapshot().components.find((c) => c.id === 'a')?.x).toBe(0);
    e.align('a', 'right');
    expect(e.snapshot().components.find((c) => c.id === 'a')?.x).toBe(1100); // 1200 - 100
    e.align('a', 'center-h');
    expect(e.snapshot().components.find((c) => c.id === 'a')?.x).toBe(550); // (1200-100)/2
    e.align('a', 'top');
    expect(e.snapshot().components.find((c) => c.id === 'a')?.y).toBe(0);
    e.align('a', 'bottom');
    expect(e.snapshot().components.find((c) => c.id === 'a')?.y).toBe(650);
    e.align('a', 'center-v');
    expect(e.snapshot().components.find((c) => c.id === 'a')?.y).toBe(325);
  });

  it('undo/redo 配对使用', () => {
    const e = createSceneEditor(sampleComponents);
    e.add({ id: 'd', type: 'agv', name: 'AGV-02', x: 100, y: 200, width: 24, height: 16, rotation: 0, properties: {} });
    expect(e.snapshot().components).toHaveLength(4);
    expect(e.undo()).toBe(true);
    expect(e.snapshot().components).toHaveLength(3);
    expect(e.redo()).toBe(true);
    expect(e.snapshot().components).toHaveLength(4);
  });

  it('undo 栈空时返回 false', () => {
    const e = createSceneEditor(sampleComponents);
    expect(e.undo()).toBe(false);
  });

  it('redo 栈空时返回 false', () => {
    const e = createSceneEditor(sampleComponents);
    expect(e.redo()).toBe(false);
  });

  it('新操作清空 redo 栈', () => {
    const e = createSceneEditor(sampleComponents);
    e.add({ id: 'd', type: 'shelf', name: 'A-03', x: 400, y: 0, width: 100, height: 50, rotation: 0, properties: {} });
    e.undo();
    expect(e.snapshot().futureLength).toBe(1);
    e.add({ id: 'e', type: 'agv', name: 'AGV-02', x: 50, y: 200, width: 24, height: 16, rotation: 0, properties: {} });
    expect(e.snapshot().futureLength).toBe(0);
  });

  it('历史栈上限 30 步', () => {
    const e = createSceneEditor(sampleComponents);
    for (let i = 0; i < 40; i++) {
      e.add({ id: `d-${i}`, type: 'shelf', name: `S-${i}`, x: i * 10, y: 0, width: 10, height: 10, rotation: 0, properties: {} });
    }
    expect(e.snapshot().historyLength).toBe(30); // 上限
  });

  it('不存在的 ID 调用 update/remove/rotate 不崩溃', () => {
    const e = createSceneEditor(sampleComponents);
    expect(() => e.update('nonexistent', { x: 1 })).not.toThrow();
    expect(() => e.remove('nonexistent')).not.toThrow();
    expect(() => e.rotate('nonexistent')).not.toThrow();
    expect(e.snapshot().historyLength).toBe(0);
  });
});
