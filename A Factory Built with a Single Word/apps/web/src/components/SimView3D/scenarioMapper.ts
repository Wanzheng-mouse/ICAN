/**
 * Scenario → WarehouseConfig 转换器
 *
 * 将 2D 编辑器的 ScenarioData（components + canvas）转换为 3D 仿真的 WarehouseConfig。
 * 这是"编辑器看到什么 = 仿真显示什么"数据闭环的核心桥梁。
 *
 * 映射规则：
 * - shelf  → ShelfZone（高位存储区，含巷道/层/格口）
 * - agv    → AGV 初始位置（由 SimulationEngine 读取）
 * - arm    → 机械臂工位
 * - station→ 拣选/打包/分拣工位区
 * - charger→ 充电区
 * - canvas → 仓库外墙尺寸
 *
 * 空场景（components 为空）降级到 createWarehouseConfig() 固定工厂，并标记 fallback=true。
 */

import type { SceneComponent } from '@ican/contracts';
import type {
  WarehouseConfig,
  WarehouseZone,
  ShelfZone,
  ShelfAisle,
  RoadNetwork,
  RoadNode,
  RoadEdge,
  WallSegment,
  Door,
  Column,
  Beam,
  Point2D,
  Rect2D,
} from './digitalTwin';
import { ZoneType, WallType, DoorType, RoadDirection } from './digitalTwin';
import { createWarehouseConfig } from './warehouseFactory';

// ============================================================
// 类型
// ============================================================

interface ScenarioCanvas {
  width: number;
  height: number;
  scale: number;
}

export interface ScenarioSnapshotData {
  components: SceneComponent[];
  canvas: ScenarioCanvas;
  schema_version: string;
}

export interface ScenarioWarehouseResult {
  config: WarehouseConfig;
  /** true 表示场景为空，降级到了固定工厂 */
  fallback: boolean;
  /** 设备统计 */
  stats: {
    shelves: number;
    agvs: number;
    arms: number;
    stations: number;
    chargers: number;
  };
}

// ============================================================
// 常量
// ============================================================

const WALL_THICKNESS = 10;
const BEAM_HEIGHT = 7.5;
const COLUMN_SIZE = 8;
const LANE_SPACING = 200;

// ============================================================
// 辅助函数
// ============================================================

function groupByType(components: SceneComponent[]): Record<string, SceneComponent[]> {
  const groups: Record<string, SceneComponent[]> = {};
  for (const comp of components) {
    (groups[comp.type] ??= []).push(comp);
  }
  return groups;
}

function componentCenter(comp: SceneComponent): Point2D {
  return { x: comp.x + comp.width / 2, y: comp.y + comp.height / 2 };
}

function _componentBounds(comp: SceneComponent): Rect2D {
  return { x: comp.x, y: comp.y, w: comp.width, h: comp.height };
}

function boundsOfComponents(comps: SceneComponent[]): Rect2D | null {
  if (!comps.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of comps) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ============================================================
// 区域生成
// ============================================================

function buildZones(
  shelves: SceneComponent[],
  stations: SceneComponent[],
  chargers: SceneComponent[],
  arms: SceneComponent[],
  canvas: ScenarioCanvas,
): WarehouseZone[] {
  const zones: WarehouseZone[] = [];

  // 收货月台（左侧）
  zones.push({
    id: 'ZONE-RECV',
    name: '收货月台',
    type: ZoneType.RECV_DOCK,
    bounds: { x: 5, y: canvas.height * 0.3, w: 80, h: canvas.height * 0.4 },
    color: '#f59e0b',
  });

  // 发货月台（右侧）
  zones.push({
    id: 'ZONE-SHIP',
    name: '发货月台',
    type: ZoneType.SHIP_DOCK,
    bounds: { x: canvas.width - 85, y: canvas.height * 0.3, w: 80, h: canvas.height * 0.4 },
    color: '#84cc16',
  });

  // 存储区（基于货架聚集分组）
  if (shelves.length) {
    const shelfBounds = boundsOfComponents(shelves);
    if (shelfBounds) {
      const padding = 30;
      zones.push({
        id: 'ZONE-STORAGE',
        name: '存储区',
        type: ZoneType.HIGH_BAY_STORAGE,
        bounds: {
          x: Math.max(0, shelfBounds.x - padding),
          y: Math.max(0, shelfBounds.y - padding),
          w: shelfBounds.w + padding * 2,
          h: shelfBounds.h + padding * 2,
        },
        color: '#3b82f6',
      });
    }
  }

  // 拣选/打包区（基于工位位置）
  if (stations.length) {
    const stBounds = boundsOfComponents(stations);
    if (stBounds) {
      const hasPick = stations.some(s => s.properties.station_type === 'pick' || !s.properties.station_type);
      const hasPack = stations.some(s => s.properties.station_type === 'pack');
      if (hasPick) {
        zones.push({
          id: 'ZONE-PICK',
          name: '拣选区',
          type: ZoneType.PICK_ZONE,
          bounds: { x: stBounds.x - 20, y: stBounds.y - 20, w: stBounds.w + 40, h: stBounds.h + 40 },
          color: '#f97316',
        });
      }
      if (hasPack) {
        zones.push({
          id: 'ZONE-PACK',
          name: '打包区',
          type: ZoneType.PACK_ZONE,
          bounds: { x: stBounds.x + stBounds.w / 2, y: stBounds.y - 20, w: stBounds.w / 2 + 40, h: stBounds.h + 40 },
          color: '#ef4444',
        });
      }
      if (!hasPick && !hasPack) {
        zones.push({
          id: 'ZONE-PICK',
          name: '工位区',
          type: ZoneType.PICK_ZONE,
          bounds: { x: stBounds.x - 20, y: stBounds.y - 20, w: stBounds.w + 40, h: stBounds.h + 40 },
          color: '#f97316',
        });
      }
    }
  }

  // 充电区（基于充电桩位置）
  if (chargers.length) {
    const chBounds = boundsOfComponents(chargers);
    if (chBounds) {
      zones.push({
        id: 'ZONE-CHARGE',
        name: '充电区',
        type: ZoneType.CHARGE_ZONE,
        bounds: { x: chBounds.x - 20, y: chBounds.y - 20, w: chBounds.w + 40, h: chBounds.h + 40 },
        color: '#64748b',
      });
    }
  } else {
    // 默认充电区在底部
    zones.push({
      id: 'ZONE-CHARGE',
      name: '充电区',
      type: ZoneType.CHARGE_ZONE,
      bounds: { x: canvas.width * 0.2, y: canvas.height - 120, w: 180, h: 100 },
      color: '#64748b',
    });
  }

  return zones;
}

// ============================================================
// 货架区生成
// ============================================================

function buildShelfZones(shelves: SceneComponent[]): ShelfZone[] {
  if (!shelves.length) return [];

  // 将货架按 x 坐标聚类成巷道
  const sorted = [...shelves].sort((a, b) => a.x - b.x || a.y - b.y);
  const aisleGroups: SceneComponent[][] = [];
  let currentGroup: SceneComponent[] = [];

  for (const shelf of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(shelf);
    } else {
      const last = currentGroup[currentGroup.length - 1];
      // 同一巷道：x 距离接近且 y 间距合理
      if (Math.abs(shelf.x - last.x) < 60 && Math.abs(shelf.y - last.y) < 200) {
        currentGroup.push(shelf);
      } else {
        aisleGroups.push(currentGroup);
        currentGroup = [shelf];
      }
    }
  }
  if (currentGroup.length) aisleGroups.push(currentGroup);

  const shelfZones: ShelfZone[] = [];
  const storageZoneBounds = boundsOfComponents(shelves);
  if (!storageZoneBounds) return [];

  const aisles: ShelfAisle[] = aisleGroups.map((group, idx) => {
    const bounds = boundsOfComponents(group);
    const length = bounds?.w ?? 200;
    const width = bounds?.h ?? 45;
    return {
      aisleId: `AISLE-S${idx + 1}`,
      zoneId: 'ZONE-STORAGE',
      levels: [
        {
          level: 1,
          height: 0.5,
          slots: Array.from({ length: Math.max(4, Math.floor(length / 30)) }, (_, j) => ({
            slotId: `S${idx + 1}-L1-${j + 1}`,
            position: j + 1,
            occupancy: 0.3 + Math.random() * 0.5,
            maxWeight: 500,
          })),
        },
        {
          level: 2,
          height: 1.8,
          slots: Array.from({ length: Math.max(4, Math.floor(length / 30)) }, (_, j) => ({
            slotId: `S${idx + 1}-L2-${j + 1}`,
            position: j + 1,
            occupancy: 0.2 + Math.random() * 0.5,
            maxWeight: 400,
          })),
        },
        {
          level: 3,
          height: 3.1,
          slots: Array.from({ length: Math.max(4, Math.floor(length / 30)) }, (_, j) => ({
            slotId: `S${idx + 1}-L3-${j + 1}`,
            position: j + 1,
            occupancy: 0.1 + Math.random() * 0.4,
            maxWeight: 300,
          })),
        },
      ],
      length,
      width,
    };
  });

  shelfZones.push({
    zoneId: 'ZONE-STORAGE',
    name: '存储货架区',
    type: 'high-bay',
    aisles,
    position: { x: storageZoneBounds.x, y: storageZoneBounds.y },
    dimensions: { w: storageZoneBounds.w, h: storageZoneBounds.h, d: 160 },
  });

  return shelfZones;
}

// ============================================================
// 路网生成（基础网格）
// ============================================================

function _buildLegacyRoadNetwork(canvas: ScenarioCanvas, components: SceneComponent[]): RoadNetwork {
  const nodes = new Map<string, RoadNode>();
  const edges = new Map<string, RoadEdge>();
  const adjacency = new Map<string, string[]>();

  const w = canvas.width;
  const h = canvas.height;
  const cols = Math.max(3, Math.floor(w / LANE_SPACING));
  const rows = Math.max(3, Math.floor(h / LANE_SPACING));
  const stepX = w / (cols + 1);
  const stepY = h / (rows + 1);

  const nodeDefs: Array<{ id: string; pos: Point2D; type: RoadNode['type'] }> = [];

  // 生成网格节点
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(stepX * (c + 1));
      const y = Math.round(stepY * (r + 1));
      const id = `N-${r}-${c}`;
      nodeDefs.push({ id, pos: { x, y }, type: 'junction' });
    }
  }

  // 为设备添加入口节点
  let entryIdx = 0;
  for (const comp of components) {
    if (comp.type === 'station') {
      const center = componentCenter(comp);
      const id = `N-STATION-${entryIdx++}`;
      nodeDefs.push({ id, pos: center, type: 'station_entry' });
    } else if (comp.type === 'charger') {
      const center = componentCenter(comp);
      const id = `N-CHG-${entryIdx++}`;
      nodeDefs.push({ id, pos: center, type: 'charger_entry' });
    }
  }

  // 注册节点
  for (const nd of nodeDefs) {
    nodes.set(nd.id, { id: nd.id, position: nd.pos, type: nd.type, reservationTable: [] });
    adjacency.set(nd.id, []);
  }

  // 连接相邻网格节点
  let edgeIdx = 0;
  const connect = (fromId: string, toId: string, len: number) => {
    const eid1 = `E-${++edgeIdx}`;
    edges.set(eid1, {
      id: eid1, from: fromId, to: toId,
      direction: RoadDirection.BIDIRECTIONAL, length: len,
      speedLimit: 1.2, capacity: 1, currentOccupants: [], isBlocked: false,
    });
    adjacency.get(fromId)!.push(toId);
    const eid2 = `E-${++edgeIdx}`;
    edges.set(eid2, {
      id: eid2, from: toId, to: fromId,
      direction: RoadDirection.BIDIRECTIONAL, length: len,
      speedLimit: 1.2, capacity: 1, currentOccupants: [], isBlocked: false,
    });
    adjacency.get(toId)!.push(fromId);
  };

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const id = `N-${r}-${c}`;
      // 水平连接
      if (c < cols) {
        const right = `N-${r}-${c + 1}`;
        const len = Math.abs(stepX);
        connect(id, right, len);
      }
      // 垂直连接
      if (r < rows) {
        const below = `N-${r + 1}-${c}`;
        const len = Math.abs(stepY);
        connect(id, below, len);
      }
    }
  }

  // 将设备入口节点连接到最近的网格节点
  for (const nd of nodeDefs) {
    if (nd.type === 'junction') continue;
    let nearest: { id: string; dist: number } | null = null;
    for (const [nid, node] of nodes) {
      if (node.type !== 'junction') continue;
      const dist = Math.hypot(node.position.x - nd.pos.x, node.position.y - nd.pos.y);
      if (!nearest || dist < nearest.dist) nearest = { id: nid, dist };
    }
    if (nearest) {
      connect(nd.id, nearest.id, nearest.dist);
    }
  }

  return { nodes, edges, adjacency };
}

/**
 * Build the only road network used by both routing and 3D rendering.
 * The previous regular grid ignored equipment footprints, so a visually
 * plausible line could still pass through a shelf.  This version rejects
 * every road node and edge that enters an inflated physical obstacle.
 */
function buildRoadNetwork(canvas: ScenarioCanvas, components: SceneComponent[]): RoadNetwork {
  const nodes = new Map<string, RoadNode>();
  const edges = new Map<string, RoadEdge>();
  const adjacency = new Map<string, string[]>();
  const { width: w, height: h } = canvas;
  const roadMargin = 48;
  const safetyClearance = 42;
  const obstacleTypes = new Set<SceneComponent['type']>(['shelf', 'station', 'charger', 'arm', 'conveyor', 'obstacle']);
  const obstacles = components
    .filter((component) => obstacleTypes.has(component.type))
    .map((component) => ({
      x: component.x - safetyClearance,
      y: component.y - safetyClearance,
      w: component.width + safetyClearance * 2,
      h: component.height + safetyClearance * 2,
    }));
  const isFree = (point: Point2D) =>
    point.x >= roadMargin && point.x <= w - roadMargin && point.y >= roadMargin && point.y <= h - roadMargin &&
    !obstacles.some((rect) => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h);
  const isClearSegment = (from: Point2D, to: Point2D) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 18));
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      if (!isFree({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio })) return false;
    }
    return true;
  };
  const addNode = (id: string, position: Point2D, type: RoadNode['type']) => {
    nodes.set(id, { id, position, type, reservationTable: [] });
    adjacency.set(id, []);
  };
  let edgeIdx = 0;
  const connect = (fromId: string, toId: string) => {
    const from = nodes.get(fromId);
    const to = nodes.get(toId);
    if (!from || !to || !isClearSegment(from.position, to.position)) return;
    const length = Math.hypot(to.position.x - from.position.x, to.position.y - from.position.y);
    for (const [source, target] of [[fromId, toId], [toId, fromId]] as const) {
      const id = `E-${++edgeIdx}`;
      edges.set(id, { id, from: source, to: target, direction: RoadDirection.BIDIRECTIONAL, length, speedLimit: 1.2, capacity: 1, currentOccupants: [], isBlocked: false });
      adjacency.get(source)!.push(target);
    }
  };

  const cols = Math.max(4, Math.floor((w - roadMargin * 2) / LANE_SPACING));
  const rows = Math.max(3, Math.floor((h - roadMargin * 2) / LANE_SPACING));
  const stepX = (w - roadMargin * 2) / cols;
  const stepY = (h - roadMargin * 2) / rows;
  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) {
      const point = { x: Math.round(roadMargin + col * stepX), y: Math.round(roadMargin + row * stepY) };
      if (isFree(point)) addNode(`N-${row}-${col}`, point, 'junction');
    }
  }
  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) {
      const id = `N-${row}-${col}`;
      if (!nodes.has(id)) continue;
      const right = `N-${row}-${col + 1}`;
      const below = `N-${row + 1}-${col}`;
      if (nodes.has(right)) connect(id, right);
      if (nodes.has(below)) connect(id, below);
    }
  }

  const approachPoint = (component: SceneComponent): Point2D | null => {
    const gap = safetyClearance + 18;
    const cx = component.x + component.width / 2;
    const cy = component.y + component.height / 2;
    const candidates = [
      { x: cx, y: component.y + component.height + gap },
      { x: cx, y: component.y - gap },
      { x: component.x - gap, y: cy },
      { x: component.x + component.width + gap, y: cy },
    ];
    return candidates.find(isFree) ?? null;
  };
  let entryIdx = 0;
  for (const component of components) {
    if (!['station', 'charger', 'shelf'].includes(component.type)) continue;
    const position = approachPoint(component);
    if (!position) continue;
    const id = `N-ENTRY-${entryIdx++}`;
    addNode(id, position, component.type === 'charger' ? 'charger_entry' : 'station_entry');
    const nearest = [...nodes.values()]
      .filter((node) => node.type === 'junction')
      .map((node) => ({ id: node.id, distance: Math.hypot(node.position.x - position.x, node.position.y - position.y) }))
      .sort((a, b) => a.distance - b.distance)
      .find((candidate) => isClearSegment(position, nodes.get(candidate.id)!.position));
    if (nearest) connect(id, nearest.id);
  }
  return { nodes, edges, adjacency };
}

// ============================================================
// 墙体和门
// ============================================================

function buildWalls(canvas: ScenarioCanvas): WallSegment[] {
  const w = canvas.width;
  const h = canvas.height;
  const doorGap = 120;
  const doorY = h / 2;
  return [
    { id: 'W-EXT-1', type: WallType.EXTERIOR, start: { x: 5, y: 5 }, end: { x: w - 5, y: 5 }, height: BEAM_HEIGHT },
    { id: 'W-EXT-2A', type: WallType.EXTERIOR, start: { x: w - 5, y: 5 }, end: { x: w - 5, y: doorY - doorGap / 2 }, height: BEAM_HEIGHT },
    { id: 'W-EXT-2B', type: WallType.EXTERIOR, start: { x: w - 5, y: doorY + doorGap / 2 }, end: { x: w - 5, y: h - 5 }, height: BEAM_HEIGHT },
    { id: 'W-EXT-3', type: WallType.EXTERIOR, start: { x: w - 5, y: h - 5 }, end: { x: 5, y: h - 5 }, height: BEAM_HEIGHT },
    { id: 'W-EXT-4A', type: WallType.EXTERIOR, start: { x: 5, y: h - 5 }, end: { x: 5, y: doorY + doorGap / 2 }, height: BEAM_HEIGHT },
    { id: 'W-EXT-4B', type: WallType.EXTERIOR, start: { x: 5, y: doorY - doorGap / 2 }, end: { x: 5, y: 5 }, height: BEAM_HEIGHT },
  ];
}

function buildDoors(canvas: ScenarioCanvas): Door[] {
  const doorY = canvas.height / 2;
  return [
    { id: 'DOOR-RECV', type: DoorType.ROLLING_SHUTTER, position: { x: 5, y: doorY }, width: 120, isOpen: true, relatedZoneId: 'ZONE-RECV' },
    { id: 'DOOR-SHIP', type: DoorType.ROLLING_SHUTTER, position: { x: canvas.width - 5, y: doorY }, width: 120, isOpen: true, relatedZoneId: 'ZONE-SHIP' },
    { id: 'DOOR-PERSONNEL-1', type: DoorType.PERSONNEL, position: { x: canvas.width * 0.1, y: 5 }, width: 10, isOpen: true },
    { id: 'DOOR-PERSONNEL-2', type: DoorType.PERSONNEL, position: { x: canvas.width * 0.9, y: 5 }, width: 10, isOpen: true },
    { id: 'DOOR-FIRE-1', type: DoorType.FIRE_EXIT, position: { x: canvas.width / 2, y: canvas.height - 5 }, width: 18, isOpen: false },
  ];
}

function buildColumns(canvas: ScenarioCanvas): Column[] {
  const cols: Column[] = [];
  let idx = 0;
  for (let x = LANE_SPACING; x < canvas.width - 50; x += LANE_SPACING) {
    for (let y = LANE_SPACING; y < canvas.height - 50; y += LANE_SPACING) {
      cols.push({ id: `COL-${++idx}`, position: { x, y }, size: COLUMN_SIZE, height: BEAM_HEIGHT });
    }
  }
  return cols;
}

function buildBeams(canvas: ScenarioCanvas): Beam[] {
  const beams: Beam[] = [];
  let idx = 0;
  for (let y = 100; y < canvas.height; y += LANE_SPACING) {
    beams.push({ id: `BEAM-${++idx}`, start: { x: 5, y }, end: { x: canvas.width - 5, y }, height: BEAM_HEIGHT });
  }
  return beams;
}

function buildSafetyAreas(chargers: SceneComponent[]): Rect2D[] {
  return chargers.map((c) => ({
    x: c.x - 20,
    y: c.y - 20,
    w: c.width + 40,
    h: c.height + 40,
  }));
}

// ============================================================
// 主转换函数
// ============================================================

/**
 * 将 2D 场景数据转换为 3D 仓库配置。
 * 空场景降级到固定工厂。
 */
export function scenarioToWarehouseConfig(
  data: ScenarioSnapshotData | null | undefined,
): ScenarioWarehouseResult {
  const components = data?.components ?? [];
  const canvas = data?.canvas ?? { width: 1200, height: 800, scale: 1 };

  // 空场景降级
  if (!components.length) {
    return {
      config: createWarehouseConfig(),
      fallback: true,
      stats: { shelves: 0, agvs: 0, arms: 0, stations: 0, chargers: 0 },
    };
  }

  const groups = groupByType(components);
  const shelves = groups.shelf ?? [];
  const agvs = groups.agv ?? [];
  const arms = groups.arm ?? [];
  const stations = groups.station ?? [];
  const chargers = groups.charger ?? [];
  const _obstacles = groups.obstacle ?? [];

  const zones = buildZones(shelves, stations, chargers, arms, canvas);
  const shelfZones = buildShelfZones(shelves);
  const roadNetwork = buildRoadNetwork(canvas, components);
  const walls = buildWalls(canvas);
  const doors = buildDoors(canvas);
  const columns = buildColumns(canvas);
  const beams = buildBeams(canvas);
  const safetyAreas = buildSafetyAreas(chargers);

  const config: WarehouseConfig = {
    width: canvas.width,
    height: canvas.height,
    ceilingHeight: BEAM_HEIGHT,
    wallThickness: WALL_THICKNESS,
    zones,
    shelfZones,
    roadNetwork,
    doors,
    walls,
    safetyAreas,
    columns,
    beams,
  };

  return {
    config,
    fallback: false,
    stats: {
      shelves: shelves.length,
      agvs: agvs.length,
      arms: arms.length,
      stations: stations.length,
      chargers: chargers.length,
    },
  };
}

/**
 * 从场景组件中提取 AGV 初始位置列表（供后端仿真引擎使用）。
 */
export function extractAgvPositions(data: ScenarioSnapshotData | null | undefined): Array<{ id: string; x: number; y: number; battery: number; agvType?: string }> {
  const components = data?.components ?? [];
  return components
    .filter((c) => c.type === 'agv')
    .map((c, _i) => ({
      id: c.id,
      x: c.x + c.width / 2,
      y: c.y + c.height / 2,
      battery: Number(c.properties.battery ?? 85),
      agvType: (c.properties.agv_type as string) ?? undefined,
    }));
}

/**
 * 从场景组件中提取工位位置列表（供后端仿真引擎使用）。
 */
export function extractStationPositions(data: ScenarioSnapshotData | null | undefined): Array<{ id: string; x: number; y: number; type: string }> {
  const components = data?.components ?? [];
  return components
    .filter((c) => c.type === 'station' || c.type === 'charger')
    .map((c) => ({
      id: c.id,
      x: c.x + c.width / 2,
      y: c.y + c.height / 2,
      type: c.type === 'charger' ? 'charge' : String(c.properties.station_type ?? 'pick'),
    }));
}
