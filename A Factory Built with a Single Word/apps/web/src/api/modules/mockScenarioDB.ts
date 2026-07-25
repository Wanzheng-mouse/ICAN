/**
 * Mock 场景数据库（内存 Map，按 ID 持久化）
 *
 * 用途：
 * - createScenario(id) 鈫?鍐欏叆绌烘暟鎹? * - getScenario(id) 鈫?杩斿洖瀵瑰簲鏁版嵁
 * - saveScenario(id, data) 鈫?鏇存柊鏁版嵁
 *
 * 这样在 VITE_USE_MOCK=true 时刷新页面后仍可读取同一场景。
 */
import type { SceneComponent } from '@ican/contracts';

export interface ScenarioRecord {
  projectId: string;
  name: string;
  components: SceneComponent[];
  canvas: { width: number; height: number; scale: number };
  schemaVersion: string;
  version: number;
  updatedAt: string;
  versions: ScenarioSnapshot[];
}

export interface ScenarioSnapshot {
  version: number;
  name: string;
  components: SceneComponent[];
  canvas: ScenarioRecord['canvas'];
  schemaVersion: string;
  createdAt: string;
}

const DB = new Map<string, ScenarioRecord>();
const STORAGE_KEY = 'ican-mock-scenarios-v1';
let hydrated = false;

const DEFAULT_CANVAS = { width: 1200, height: 800, scale: 1 };

function cloneComponents(components: SceneComponent[]): SceneComponent[] {
  return components.map((component) => ({
    ...component,
    properties: { ...component.properties },
  }));
}

function cloneCanvas(canvas: ScenarioRecord['canvas']): ScenarioRecord['canvas'] {
  return { ...canvas };
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  const storage = getStorage();
  if (!storage) return;
  try {
    const records = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as Array<
      [string, ScenarioRecord]
    >;
    records.forEach(([id, record]) => {
      const normalized = {
        ...record,
        versions: record.versions ?? [{
          version: record.version,
          name: record.name,
          components: cloneComponents(record.components),
          canvas: cloneCanvas(record.canvas),
          schemaVersion: record.schemaVersion,
          createdAt: record.updatedAt,
        }],
      };
      DB.set(id, normalized);
    });
  } catch {
    storage.removeItem(STORAGE_KEY);
  }
}

function persist(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify([...DB.entries()]));
}

export function mockScenarioCreate(
  id: string,
  possibleData?: Partial<ScenarioRecord>,
): ScenarioRecord {
  hydrate();
  const now = new Date().toISOString();
  const base = {
    projectId: possibleData?.projectId ?? 'mock-project',
    name: possibleData?.name ?? 'Mock warehouse',
    components: cloneComponents(possibleData?.components ?? []),
    canvas: cloneCanvas(possibleData?.canvas ?? DEFAULT_CANVAS),
    schemaVersion: possibleData?.schemaVersion ?? '1.0',
    version: possibleData?.version ?? 1,
    updatedAt: now,
  };
  const record: ScenarioRecord = {
    ...base,
    versions: [{
      version: base.version,
      name: base.name,
      components: cloneComponents(base.components),
      canvas: cloneCanvas(base.canvas),
      schemaVersion: base.schemaVersion,
      createdAt: now,
    }],
  };
  DB.set(id, record);
  persist();
  return record;
}

export function mockScenarioGet(id: string): ScenarioRecord | null {
  hydrate();
  return DB.get(id) ?? null;
}

export function mockScenarioSave(
  id: string,
  components: SceneComponent[],
  canvas?: ScenarioRecord['canvas'],
  expectedVersion?: number,
): ScenarioRecord | null {
  hydrate();
  const record = DB.get(id);
  if (!record) return null;
  if (expectedVersion !== undefined && record.version !== expectedVersion) return null;
  record.components = cloneComponents(components);
  if (canvas) record.canvas = cloneCanvas(canvas);
  record.version += 1;
  record.updatedAt = new Date().toISOString();
  record.versions = [...(record.versions ?? []), {
    version: record.version,
    name: record.name,
    components: cloneComponents(record.components),
    canvas: cloneCanvas(record.canvas),
    schemaVersion: record.schemaVersion,
    createdAt: record.updatedAt,
  }];
  DB.set(id, record);
  persist();
  return record;
}

export function mockScenarioVersions(id: string): ScenarioSnapshot[] {
  hydrate();
  return [...(DB.get(id)?.versions ?? [])]
    .sort((left, right) => right.version - left.version)
    .map((snapshot) => ({
      ...snapshot,
      components: cloneComponents(snapshot.components),
      canvas: cloneCanvas(snapshot.canvas),
    }));
}

export function mockScenarioReset(): void {
  DB.clear();
  hydrated = true;
  getStorage()?.removeItem(STORAGE_KEY);
}
