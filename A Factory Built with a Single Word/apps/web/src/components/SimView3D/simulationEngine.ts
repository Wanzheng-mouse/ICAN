/**
 * Simulation engine for the digital twin warehouse.
 *
 * Complete inbound/outbound chains with sub-tasks:
 *
 * INBOUND ORDER:
 *   SUB-1: Pallet AMR → RECV_DOCK (receive cargo at dock)
 *   SUB-2: Pallet AMR → INBUF (transport to inbound buffer)
 *   SUB-3: Stacker Crane → HIGH_BAY_SHELF (putaway via crane)
 *
 * OUTBOUND ORDER:
 *   SUB-1: Stacker Crane → HIGH_BAY_SHELF (retrieve from shelf)
 *   SUB-2: Pallet AMR → INBUF (bring to sorting)
 *   SUB-3: Tote AMR → PICK_STATION (deliver to pick arm)
 *   SUB-4: Tote AMR → PACK_STATION (deliver to pack arm)
 *   SUB-5: Tote AMR → OUTBUF (deliver to outbound buffer)
 *   SUB-6: Tote AMR → SHIP_DOCK (deliver to shipping dock)
 *
 * Each sub-task has: source, destination, cargoId, requiredEquipment, completionEvent
 * Each cargo has a full lifecycle with position tracking.
 */

import type {
  AgvData,
  Task,
  TaskType,
  StationData,
  ChargerData,
  ShelfZone,
  BufferZone,
  RobotArmData,
  CongestionZone,
  SimulationSnapshot,
  SimulationMetrics,
  TimelineEntry,
  SimulationConfig,
  BatteryConfig,
} from './types';
import { DEFAULT_SIMULATION_CONFIG, DEFAULT_BATTERY_CONFIG } from './types';
import { createWarehouseConfig } from './warehouseFactory';
import type { RoadNetwork, WarehouseConfig } from './digitalTwin';
import { CargoStatus } from './digitalTwin';

const LAYOUT_W = 1200;
const LAYOUT_H = 1000;
// Renderer dimensions map the largest pallet AMR to roughly 60 × 51 layout
// units.  A 36-unit swept radius covers its forks and turn envelope; all
// roads, station berths and wall openings use this same physical constraint.
const AGV_SWEPT_RADIUS = 36;
const AGV_MIN_CENTER_DISTANCE = 80;
const PARKING_BAYS = [
  { x: 800, y: 500 },
  { x: 900, y: 500 },
  { x: 1000, y: 500 },
  { x: 1100, y: 500 },
  { x: 800, y: 600 },
  { x: 900, y: 600 },
  { x: 1000, y: 600 },
  { x: 1100, y: 600 },
] as const;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function lineIntersectsSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  wx1: number,
  wy1: number,
  wx2: number,
  wy2: number,
  safetyMargin: number,
): boolean {
  const dx = wx2 - wx1,
    dy = wy2 - wy1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) {
    const d = Math.sqrt((x1 - wx1) ** 2 + (y1 - wy1) ** 2);
    return d < safetyMargin;
  }
  const nx = dx / len,
    ny = dy / len;
  const ax = -ny,
    ay = nx;
  const d1 = Math.abs((x1 - wx1) * ax + (y1 - wy1) * ay);
  const d2 = Math.abs((x2 - wx1) * ax + (y2 - wy1) * ay);
  if (d1 > safetyMargin && d2 > safetyMargin) return false;
  // nx/ny are already unit vectors, so this dot product is the projected
  // distance in layout units. Dividing by len again made a short wall behave
  // like an infinitely long obstacle.
  const t1 = (x1 - wx1) * nx + (y1 - wy1) * ny;
  const t2 = (x2 - wx1) * nx + (y2 - wy1) * ny;
  if (t1 >= -safetyMargin && t1 <= len + safetyMargin) return true;
  if (t2 >= -safetyMargin && t2 <= len + safetyMargin) return true;
  const minX = Math.min(wx1, wx2) - safetyMargin,
    maxX = Math.max(wx1, wx2) + safetyMargin;
  const minY = Math.min(wy1, wy2) - safetyMargin,
    maxY = Math.max(wy1, wy2) + safetyMargin;
  if ((y1 <= minY && y2 >= maxY) || (y1 >= maxY && y2 <= minY)) return true;
  if ((x1 <= minX && x2 >= maxX) || (x1 >= maxX && x2 <= minX)) return true;
  return false;
}

function findNodeIdByPos(network: RoadNetwork, x: number, y: number): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const [, node] of network.nodes) {
    const d = dist(node.position, { x, y });
    if (d < bestDist) {
      bestDist = d;
      bestId = node.id;
    }
  }
  // Stations and parking bays are offset from road centre lines. Always use
  // the nearest node rather than falling back to an unsafe straight route.
  return bestId;
}

function bfsPathOnNetwork(
  network: RoadNetwork,
  from: { x: number; y: number },
  to: { x: number; y: number },
  blockedEdges: ReadonlySet<string> = new Set(),
): Array<[number, number]> {
  const fromId = findNodeIdByPos(network, from.x, from.y);
  const toId = findNodeIdByPos(network, to.x, to.y);
  if (!fromId || !toId)
    return [
      [from.x, from.y],
      [to.x, to.y],
    ];
  if (fromId === toId)
    return [
      [from.x, from.y],
      [to.x, to.y],
    ];
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();
  const queue: string[] = [fromId];
  visited.add(fromId);
  let found = false;
  while (queue.length > 0 && !found) {
    const cur = queue.shift()!;
    for (const nb of network.adjacency.get(cur) || []) {
      const edge = Array.from(network.edges.values()).find(
        (item) => item.from === cur && item.to === nb,
      );
      if (!edge || edge.isBlocked || blockedEdges.has(edge.id) || visited.has(nb)) continue;
      visited.add(nb);
      parent.set(nb, cur);
      if (nb === toId) {
        found = true;
        break;
      }
      queue.push(nb);
    }
  }
  if (!found)
    return [
      [from.x, from.y],
      [to.x, to.y],
    ];
  const pathIds: string[] = [];
  let cur: string | undefined = toId;
  while (cur) {
    pathIds.push(cur);
    cur = parent.get(cur) ?? undefined;
  }
  pathIds.reverse();
  const result: Array<[number, number]> = [[from.x, from.y]];
  for (const id of pathIds) {
    const node = network.nodes.get(id);
    if (node) result.push([node.position.x, node.position.y] as [number, number]);
  }
  result.push([to.x, to.y] as [number, number]);
  return result;
}

function findZoneById(config: WarehouseConfig, zoneId: string) {
  return config.zones.find((z) => z.id === zoneId);
}

// ============================================================
// Sub-task types for complete chains
// ============================================================

export type SubTaskType =
  | 'recv_at_dock' // Receive cargo at receiving dock
  | 'recv_to_buffer' // Transport received cargo to inbound buffer
  | 'putaway_to_shelf' // Stacker crane puts cargo on high-bay shelf
  | 'retrieve_from_shelf' // Stacker crane retrieves cargo from shelf
  | 'pick_to_station' // Deliver cargo to pick station
  | 'pack_at_station' // Pack arm packs cargo into tote
  | 'deliver_to_outbuf' // Deliver packed order to outbound buffer
  | 'deliver_to_ship' // Deliver to shipping dock
  | 'charge';

export interface SubTask {
  id: string;
  parentId: string; // parent order/task ID
  type: SubTaskType;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  cargoId?: string;
  sourceStationId?: string;
  destStationId?: string;
  requiredAgvType?: 'tote_amr' | 'pallet_amr';
  requiredArmId?: string;
  requiredChargerId?: string;
  assignedAgvId?: string;
  assignedArmId?: string;
  progress: number;
  etaSeconds: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// ============================================================
// Simulation Engine
// ============================================================

export class SimulationEngine {
  private config: SimulationConfig;
  private batteryConfig: BatteryConfig;
  private warehouseConfig: WarehouseConfig;
  private roadNetwork: RoadNetwork;
  private simTime = 0;
  private agvs: AgvData[] = [];
  private stations: StationData[] = [];
  private chargers: ChargerData[] = [];
  private zones: ShelfZone[] = [];
  private buffers: BufferZone[] = [];
  private arms: RobotArmData[] = [];
  private tasks: Task[] = [];
  private subTasks: SubTask[] = [];
  private timeline: TimelineEntry[] = [];
  private metrics: SimulationMetrics = {
    completedTasks: 0,
    averageWaitSeconds: 0,
    utilization: 0,
    congestionScore: 0,
    totalOrdersGenerated: 0,
    activeChargers: 0,
    faultCount: 0,
  };

  // Cargo entities with full lifecycle
  private cargos: Array<{
    id: string;
    sku: string;
    type: 'tote' | 'carton' | 'pallet';
    quantity: number;
    weight: number;
    status: string;
    locationId: string;
    orderId?: string;
    subTaskId?: string;
  }> = [];
  private nextCargoId = 0;

  private orderTimer = 0;
  private nextOrderId = 0;
  private nextSubTaskId = 0;
  private nextFaultTime = 0;
  private roadClosed = false;
  private orderSurge = false;
  private orderSurgeUntil = 0;
  private minAgvDistance = AGV_MIN_CENTER_DISTANCE;
  private wallObstacles: Array<{
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    hw: number;
  }> = [];
  private blockedEdges: Set<string> = new Set(); // edge IDs that are blocked
  private deadlockDetected = false;
  private deadlockTimeout = 20;
  // Until edge-level reservations are enabled, admit a bounded number of
  // vehicles into the compact prototype road network. This prevents every
  // pending order from launching an AGV into the same corridor at once.
  private maxConcurrentAgvs = 3;
  private lastMovementTime = new Map<string, number>();
  private trafficHoldUntil = new Map<string, number>();

  constructor(config?: Partial<SimulationConfig>, warehouseConfig?: WarehouseConfig) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    this.batteryConfig = DEFAULT_BATTERY_CONFIG;
    this.warehouseConfig = warehouseConfig ?? createWarehouseConfig();
    this.roadNetwork = this.warehouseConfig.roadNetwork;
    this.initWorld();
  }

  private initWorld(): void {
    this.agvs = [];
    const toteAmrCount = Math.max(4, Math.floor(this.config.agvCount * 0.75));
    const palletAmrCount = this.config.agvCount - toteAmrCount;

    for (let i = 0; i < toteAmrCount; i++) {
      const dock = PARKING_BAYS[i % PARKING_BAYS.length];
      this.agvs.push({
        id: `TAMR-${String(i + 1).padStart(2, '0')}`,
        name: `TAMR-${String(i + 1).padStart(2, '0')}`,
        position: { ...dock },
        homePosition: { ...dock },
        route: [],
        state: 'idle',
        battery: 95 - Math.random() * 10,
        remainingSeconds: 0,
        loadStatus: 'empty',
        speed: this.config.emptySpeed,
        isBlocked: false,
        completedTasks: 0,
        totalDistance: 0,
        taskType: 'outbound',
        type: 'tote_amr',
      });
    }
    for (let i = 0; i < palletAmrCount; i++) {
      const dock = PARKING_BAYS[(toteAmrCount + i) % PARKING_BAYS.length];
      this.agvs.push({
        id: `PAMR-${String(i + 1).padStart(2, '0')}`,
        name: `PAMR-${String(i + 1).padStart(2, '0')}`,
        position: { ...dock },
        homePosition: { ...dock },
        route: [],
        state: 'idle',
        battery: 95 - Math.random() * 10,
        remainingSeconds: 0,
        loadStatus: 'empty',
        speed: this.config.emptySpeed * 0.8,
        isBlocked: false,
        completedTasks: 0,
        totalDistance: 0,
        taskType: 'inbound',
        type: 'pallet_amr',
      });
    }

    const pickZone = findZoneById(this.warehouseConfig, 'ZONE-PICK');
    const packZone = findZoneById(this.warehouseConfig, 'ZONE-PACK');
    const inboundZone = findZoneById(this.warehouseConfig, 'ZONE-INBUF');

    this.stations = [
      {
        id: 'ST-PICK-A',
        name: '拣选工位 A',
        type: 'pick',
        position: pickZone
          ? { x: pickZone.bounds.x + 65, y: pickZone.bounds.y + 85 }
          : { x: 315, y: 485 },
        state: 'idle',
        queueLength: 0,
        processingTime: 5,
        elapsedProcessing: 0,
        avgProcessingTime: 5,
        totalProcessed: 0,
      },
      {
        id: 'ST-PICK-B',
        name: '拣选工位 B',
        type: 'pick',
        position: pickZone
          ? { x: pickZone.bounds.x + 125, y: pickZone.bounds.y + 85 }
          : { x: 375, y: 485 },
        state: 'idle',
        queueLength: 0,
        processingTime: 5,
        elapsedProcessing: 0,
        avgProcessingTime: 5,
        totalProcessed: 0,
      },
      {
        id: 'ST-PACK-1',
        name: '打包工位 1',
        type: 'pack',
        position: packZone
          ? { x: packZone.bounds.x + 75, y: packZone.bounds.y + 85 }
          : { x: 595, y: 485 },
        state: 'idle',
        queueLength: 0,
        processingTime: 8,
        elapsedProcessing: 0,
        avgProcessingTime: 8,
        totalProcessed: 0,
      },
      {
        id: 'ST-PACK-2',
        name: '打包工位 2',
        type: 'pack',
        position: packZone
          ? { x: packZone.bounds.x + 130, y: packZone.bounds.y + 60 }
          : { x: 650, y: 460 },
        state: 'idle',
        queueLength: 0,
        processingTime: 8,
        elapsedProcessing: 0,
        avgProcessingTime: 8,
        totalProcessed: 0,
      },
      {
        id: 'ST-INBOUND',
        name: '入库工位',
        type: 'inbound',
        position: inboundZone
          ? { x: inboundZone.bounds.x + 15, y: inboundZone.bounds.y + 100 }
          : { x: 180, y: 480 },
        state: 'idle',
        queueLength: 0,
        processingTime: 3,
        elapsedProcessing: 0,
        avgProcessingTime: 3,
        totalProcessed: 0,
      },
      {
        id: 'ST-OUTBOUND',
        name: '出库口',
        type: 'outbound',
        position: { x: 1140, y: 500 },
        state: 'idle',
        queueLength: 0,
        processingTime: 1,
        elapsedProcessing: 0,
        avgProcessingTime: 1,
        totalProcessed: 0,
      },
      {
        id: 'ST-RECV',
        name: '收货口',
        type: 'inbound',
        position: { x: 45, y: 500 },
        state: 'idle',
        queueLength: 0,
        processingTime: 2,
        elapsedProcessing: 0,
        avgProcessingTime: 2,
        totalProcessed: 0,
      },
    ];

    const chargeZone = findZoneById(this.warehouseConfig, 'ZONE-CHARGE');
    if (chargeZone) {
      const cx = chargeZone.bounds.x + chargeZone.bounds.w / 2;
      const cy = chargeZone.bounds.y + chargeZone.bounds.h / 2;
      this.chargers = [
        {
          id: 'CHG-01',
          name: '充电桩 1',
          position: { x: cx - 40, y: cy - 15 },
          queue: [],
          chargingProgress: 0,
          remainingSeconds: 0,
        },
        {
          id: 'CHG-02',
          name: '充电桩 2',
          position: { x: cx + 40, y: cy - 15 },
          queue: [],
          chargingProgress: 0,
          remainingSeconds: 0,
        },
      ];
    } else {
      this.chargers = [
        {
          id: 'CHG-01',
          name: '充电桩 1',
          position: { x: 250, y: 830 },
          queue: [],
          chargingProgress: 0,
          remainingSeconds: 0,
        },
        {
          id: 'CHG-02',
          name: '充电桩 2',
          position: { x: 330, y: 830 },
          queue: [],
          chargingProgress: 0,
          remainingSeconds: 0,
        },
      ];
    }

    const hbaZone = findZoneById(this.warehouseConfig, 'ZONE-HBA');
    const hbbZone = findZoneById(this.warehouseConfig, 'ZONE-HBB');
    const sortZoneData = findZoneById(this.warehouseConfig, 'ZONE-SORT');
    this.zones = [
      {
        id: 'ZONE-HBA',
        name: 'A 区 (高位存储)',
        type: 'high-turnover',
        x: hbaZone?.bounds.x ?? 250,
        y: hbaZone?.bounds.y ?? 20,
        w: hbaZone?.bounds.w ?? 260,
        h: hbaZone?.bounds.h ?? 360,
        color: '#3b82f6',
        shelves: Array.from({ length: 8 }, (_, i) => ({
          id: `A-${i + 1}`,
          occupancy: Math.random() * 0.8 + 0.2,
        })),
      },
      {
        id: 'ZONE-HBB',
        name: 'B 区 (高位存储)',
        type: 'high-turnover',
        x: hbbZone?.bounds.x ?? 530,
        y: hbbZone?.bounds.y ?? 20,
        w: hbbZone?.bounds.w ?? 260,
        h: hbbZone?.bounds.h ?? 360,
        color: '#22c55e',
        shelves: Array.from({ length: 8 }, (_, i) => ({
          id: `B-${i + 1}`,
          occupancy: Math.random() * 0.7 + 0.3,
        })),
      },
      {
        id: 'ZONE-PICK',
        name: 'C 区 (拣选)',
        type: 'normal',
        x: pickZone?.bounds.x ?? 250,
        y: pickZone?.bounds.y ?? 400,
        w: pickZone?.bounds.w ?? 160,
        h: pickZone?.bounds.h ?? 160,
        color: '#f59e0b',
        shelves: Array.from({ length: 4 }, (_, i) => ({
          id: `C-${i + 1}`,
          occupancy: Math.random() * 0.6 + 0.2,
        })),
      },
      {
        id: 'ZONE-SORT',
        name: 'D 区 (分拣)',
        type: 'normal',
        x: sortZoneData?.bounds.x ?? 430,
        y: sortZoneData?.bounds.y ?? 420,
        w: sortZoneData?.bounds.w ?? 70,
        h: sortZoneData?.bounds.h ?? 140,
        color: '#a855f7',
        shelves: Array.from({ length: 4 }, (_, i) => ({
          id: `D-${i + 1}`,
          occupancy: Math.random() * 0.5 + 0.2,
        })),
      },
    ];

    const inboundBufferZone = findZoneById(this.warehouseConfig, 'ZONE-INBUF');
    const outbufZone = findZoneById(this.warehouseConfig, 'ZONE-OUTBUF');
    this.buffers = [
      {
        id: 'BUF-IN',
        name: '入库缓冲区',
        type: 'inbound',
        position: inboundBufferZone
          ? {
              x: inboundBufferZone.bounds.x + inboundBufferZone.bounds.w / 2,
              y: inboundBufferZone.bounds.y + inboundBufferZone.bounds.h / 2,
            }
          : { x: 200, y: 500 },
        w: 60,
        h: 50,
        capacity: 5,
        currentCount: 0,
      },
      {
        id: 'BUF-OUT',
        name: '出库缓冲区',
        type: 'outbound',
        position: outbufZone
          ? {
              x: outbufZone.bounds.x + outbufZone.bounds.w / 2,
              y: outbufZone.bounds.y + outbufZone.bounds.h / 2,
            }
          : { x: 330, y: 650 },
        w: 80,
        h: 50,
        capacity: 5,
        currentCount: 0,
      },
    ];

    const pickA = this.stations.find((s) => s.id === 'ST-PICK-A');
    const pickB = this.stations.find((s) => s.id === 'ST-PICK-B');
    const pack1 = this.stations.find((s) => s.id === 'ST-PACK-1');
    const inbound = this.stations.find((s) => s.id === 'ST-INBOUND');
    this.arms = [
      {
        id: 'ARM-PICK-A',
        name: '拣选臂 A',
        stationId: pickA?.id ?? '',
        position: pickA
          ? { x: pickA.position.x - 25, y: pickA.position.y + 30 }
          : { x: 255, y: 490 },
        state: 'idle',
      },
      {
        id: 'ARM-PICK-B',
        name: '拣选臂 B',
        stationId: pickB?.id ?? '',
        position: pickB
          ? { x: pickB.position.x - 25, y: pickB.position.y + 30 }
          : { x: 355, y: 490 },
        state: 'idle',
      },
      {
        id: 'ARM-PACK-01',
        name: '打包臂 1',
        stationId: pack1?.id ?? '',
        position: pack1
          ? { x: pack1.position.x - 25, y: pack1.position.y + 30 }
          : { x: 525, y: 490 },
        state: 'idle',
      },
      {
        id: 'ARM-INBOUND-01',
        name: '入库臂 1',
        stationId: inbound?.id ?? '',
        position: inbound
          ? { x: inbound.position.x - 25, y: inbound.position.y + 30 }
          : { x: 175, y: 510 },
        state: 'idle',
      },
    ];

    this.wallObstacles = this.warehouseConfig.walls.map((w) => ({
      id: w.id,
      x1: w.start.x,
      y1: w.start.y,
      x2: w.end.x,
      y2: w.end.y,
      hw: this.warehouseConfig.wallThickness / 2,
    }));

    this.nextFaultTime = 40 + Math.random() * 30;
  }

  tick(dt: number): SimulationSnapshot {
    this.simTime += dt;
    this.generateOrders(dt);
    this.advanceAgvs(dt);
    this.dispatchSubTasks(dt);
    this.advanceStations(dt);
    this.advanceChargers(dt);
    this.handleAnomalies(dt);
    this.detectDeadlock();
    const congestion = this.computeCongestion();
    this.updateMetrics();
    return this.buildSnapshot(congestion);
  }

  // ============================================================
  // Order generation with sub-task chain creation
  // ============================================================

  private generateOrders(dt: number): void {
    const interval = this.orderSurge
      ? randRange(2, 5)
      : randRange(this.config.orderIntervalMin, this.config.orderIntervalMax);
    this.orderTimer += dt;
    if (this.orderTimer >= interval) {
      this.orderTimer = 0;
      this.createOrder();
    }
    if (this.orderSurge && this.simTime > this.orderSurgeUntil) {
      this.orderSurge = false;
    }
  }

  private createOrder(): void {
    this.nextOrderId++;
    const isInbound = Math.random() < 0.35;
    const orderId = `ORD-${String(this.nextOrderId).padStart(4, '0')}`;
    const mainTaskId = `TASK-${String(this.nextOrderId).padStart(4, '0')}`;

    if (isInbound) {
      // INBOUND CHAIN: RECV → INBUF → HIGH_BAY
      const cargoType: 'tote' | 'carton' | 'pallet' = 'pallet';
      const sku = `SKU-IN-${this.nextOrderId}`;
      this.createCargo(orderId, sku, cargoType, 'ST-RECV');

      // Sub-task 1: Pallet AMR picks up at RECV
      this.createSubTask(mainTaskId, 'recv_at_dock', 'ST-RECV', 'BUF-IN', null, 'pallet_amr');
      // Sub-task 2: Pallet AMR delivers to inbound buffer
      this.createSubTask(mainTaskId, 'recv_to_buffer', 'BUF-IN', 'ST-INBOUND', null, 'pallet_amr');
      // Sub-task 3: Stacker crane puts on shelf (handled by station)
      this.createSubTask(mainTaskId, 'putaway_to_shelf', 'ST-INBOUND', 'ZONE-HBA', null, null);

      this.timeline.push({
        time: this.simTime,
        event: `入库订单 ${orderId} 到达收货口，生成 3 个子任务`,
        type: 'order',
        taskId: mainTaskId,
      });
    } else {
      // OUTBOUND CHAIN: HIGH_BAY → PICK → PACK → OUTBUF → SHIP
      const cargoType: 'tote' | 'carton' | 'pallet' = Math.random() < 0.7 ? 'tote' : 'carton';
      const sku = `SKU-OUT-${this.nextOrderId}`;
      const shelfZone = this.zones[Math.floor(Math.random() * 2)];
      this.createCargo(orderId, sku, cargoType, shelfZone.id);

      this.createSubTask(mainTaskId, 'retrieve_from_shelf', shelfZone.id, 'ST-PICK-A', null, null);
      this.createSubTask(mainTaskId, 'pick_to_station', 'ST-PICK-A', 'ST-PACK-1', null, 'tote_amr');
      this.createSubTask(mainTaskId, 'pack_at_station', 'ST-PACK-1', 'ST-OUTBOUND', null, null);
      this.createSubTask(mainTaskId, 'deliver_to_outbuf', 'ST-PACK-1', 'BUF-OUT', null, 'tote_amr');
      this.createSubTask(mainTaskId, 'deliver_to_ship', 'BUF-OUT', 'ST-OUTBOUND', null, 'tote_amr');

      this.timeline.push({
        time: this.simTime,
        event: `出库订单 ${orderId} 生成，需从 ${shelfZone.name} 拣选，生成 5 个子任务`,
        type: 'order',
        taskId: mainTaskId,
      });
    }

    this.tasks.push({
      id: mainTaskId,
      type: isInbound ? 'inbound' : 'outbound',
      status: 'assigned',
      priority: 'normal',
      progress: 0,
      etaSeconds: 60,
      createdAt: this.simTime,
    });
    this.metrics.totalOrdersGenerated++;
  }

  private createSubTask(
    parentId: string,
    type: SubTaskType,
    sourceId: string,
    destId: string,
    cargoId: string | null,
    agvType: 'tote_amr' | 'pallet_amr' | null,
  ): SubTask {
    this.nextSubTaskId++;
    const st: SubTask = {
      id: `SUB-${String(this.nextSubTaskId).padStart(4, '0')}`,
      parentId,
      type,
      status: 'pending',
      cargoId: cargoId || undefined,
      sourceStationId: sourceId,
      destStationId: destId,
      requiredAgvType: agvType || undefined,
      progress: 0,
      etaSeconds: 30 + Math.random() * 20,
      createdAt: this.simTime,
    };
    this.subTasks.push(st);
    return st;
  }

  private createCargo(
    orderId: string,
    sku: string,
    type: 'tote' | 'carton' | 'pallet',
    initialLocation: string,
  ): void {
    this.nextCargoId++;
    this.cargos.push({
      id: `CARGO-${String(this.nextCargoId).padStart(4, '0')}`,
      sku,
      type,
      quantity: Math.floor(Math.random() * 10) + 1,
      weight: Math.random() * 50 + 5,
      status: initialLocation.startsWith('ZONE-') ? CargoStatus.ON_SHELF : CargoStatus.RECEIVING,
      locationId: initialLocation,
      orderId,
    });
  }

  // ============================================================
  // Sub-task dispatching with AGV type constraints
  // ============================================================

  private dispatchSubTasks(_dt: number): void {
    // Sub-tasks are appended in workflow order. Keeping only the first
    // unfinished item of each order enforces dependencies in O(n), avoiding
    // the former repeated sibling scans that became expensive in long runs.
    const firstUnfinishedByOrder = new Map<string, SubTask>();
    for (const subTask of this.subTasks) {
      if (subTask.status !== 'completed' && !firstUnfinishedByOrder.has(subTask.parentId)) {
        firstUnfinishedByOrder.set(subTask.parentId, subTask);
      }
    }
    const pending = [...firstUnfinishedByOrder.values()].filter((st) => st.status === 'pending');
    const reservedBerths = new Set(
      this.subTasks
        .filter((st) => (st.status === 'assigned' || st.status === 'running') && st.assignedAgvId)
        .flatMap((st) =>
          [st.sourceStationId, st.destStationId].filter((id): id is string => Boolean(id)),
        ),
    );
    let activeAgvCount = this.agvs.filter(
      (agv) => agv.state !== 'idle' && agv.state !== 'fault',
    ).length;
    for (const st of pending) {
      if (st.requiredAgvType) {
        if (activeAgvCount >= this.maxConcurrentAgvs) break;
        // A physical berth can only host one approaching/handling AGV.
        // Queue later work in the dispatcher instead of stacking vehicles at
        // the exact same pickup or drop-off coordinate.
        if (
          (st.sourceStationId && reservedBerths.has(st.sourceStationId)) ||
          (st.destStationId && reservedBerths.has(st.destStationId))
        )
          continue;
        // Only dispatch AGVs that match the required type
        const candidates = this.agvs.filter(
          (a) =>
            a.state === 'idle' &&
            a.battery > this.batteryConfig.chargeThreshold &&
            a.type === st.requiredAgvType,
        );
        if (candidates.length === 0) continue;
        candidates.sort((a, b) => this.scoreAgvForSubTask(a, st) - this.scoreAgvForSubTask(b, st));
        const chosen = candidates[0];
        this.assignSubTaskToAgv(st, chosen);
        if (st.sourceStationId) reservedBerths.add(st.sourceStationId);
        if (st.destStationId) reservedBerths.add(st.destStationId);
        activeAgvCount += 1;
      } else if (
        st.type === 'putaway_to_shelf' ||
        st.type === 'retrieve_from_shelf' ||
        st.type === 'pack_at_station'
      ) {
        // These are handled by stations/arms, not AGVs
        this.executeStationSubTask(st);
      }
    }
  }

  private assignSubTaskToAgv(subTask: SubTask, agv: AgvData): void {
    subTask.status = 'assigned';
    subTask.assignedAgvId = agv.id;
    agv.taskId = subTask.id;
    agv.taskType = subTask.type as TaskType;
    agv.targetStationId = subTask.destStationId;
    agv.pickupStationId = subTask.sourceStationId;

    // Assignment reserves cargo, but it is only loaded after the vehicle has
    // physically reached the source point and finished the loading dwell.
    if (subTask.cargoId) {
      const cargo = this.cargos.find((c) => c.id === subTask.cargoId);
      if (cargo) cargo.subTaskId = subTask.id;
    }

    // Stage 1 is always source → pickup. Destination routing begins only
    // after the loading animation/dwell finishes.
    const pickup = this.getNavigationPoint(subTask.sourceStationId);
    if (!pickup) {
      subTask.status = 'failed';
      agv.taskId = undefined;
      this.timeline.push({
        time: this.simTime,
        event: `${subTask.id} 缺少取货导航点`,
        type: 'fault',
        taskId: subTask.id,
      });
      return;
    }
    agv.route = bfsPathOnNetwork(this.roadNetwork, agv.position, pickup, this.blockedEdges);
    agv.state = 'to_pickup';
    agv.remainingSeconds = 0;
    this.timeline.push({
      time: this.simTime,
      event: `${subTask.id} 分配给 ${agv.id} (${subTask.type})`,
      type: 'assign',
      agvId: agv.id,
      taskId: subTask.id,
    });
  }

  private executeStationSubTask(subTask: SubTask): void {
    // Stations and arms handle their own sub-tasks internally
    const station = this.stations.find(
      (s) => s.id === subTask.sourceStationId || s.id === subTask.destStationId,
    );
    if (station && station.state === 'idle') {
      station.state = 'working';
      station.activeTaskId = subTask.id;
      subTask.status = 'running';
      subTask.startedAt = this.simTime;
    }
  }

  private scoreAgvForSubTask(agv: AgvData, st: SubTask): number {
    const pickup = this.getNavigationPoint(st.sourceStationId);
    const destinationStation = this.stations.find((item) => item.id === st.destStationId);
    const distance = pickup ? dist(agv.position, pickup) : Number.MAX_SAFE_INTEGER;
    let score = distance / 1000 + (1 - agv.battery / 100) * 2;
    if (destinationStation && destinationStation.queueLength > 0)
      score += destinationStation.queueLength * 0.5;
    return score;
  }

  /** Resolve every workflow location to a driveable map point. */
  private getNavigationPoint(locationId?: string): { x: number; y: number } | undefined {
    if (!locationId) return undefined;
    const station = this.stations.find((item) => item.id === locationId);
    if (station) return station.position;
    const buffer = this.buffers.find((item) => item.id === locationId);
    if (buffer) return buffer.position;
    const charger = this.chargers.find((item) => item.id === locationId);
    if (charger) return charger.position;
    const zone = findZoneById(this.warehouseConfig, locationId);
    if (zone) return { x: zone.bounds.x + zone.bounds.w / 2, y: zone.bounds.y + zone.bounds.h / 2 };
    return undefined;
  }

  // ============================================================
  // AGV state machine with proper chain transitions
  // ============================================================

  private advanceAgvs(dt: number): void {
    for (const agv of this.agvs) {
      this.drainBattery(agv, dt);

      if (agv.state === 'fault') {
        if (agv.faultRecoverySeconds) {
          agv.faultRecoverySeconds -= dt;
          if (agv.faultRecoverySeconds <= 0) {
            agv.state = 'idle';
            agv.faultRecoverySeconds = undefined;
            this.timeline.push({
              time: this.simTime,
              event: `${agv.id} 故障恢复`,
              type: 'recover',
              agvId: agv.id,
            });
          }
        }
        continue;
      }

      if (agv.state === 'blocked') {
        // A traffic conflict is a short yield, not a failed task. Preserve
        // the route and resume the state that was active before yielding.
        agv.remainingSeconds -= dt;
        if (agv.remainingSeconds <= 0 || !agv.isBlocked) {
          agv.state = agv.resumeState ?? 'idle';
          agv.resumeState = undefined;
          agv.isBlocked = false;
          agv.remainingSeconds = 0;
        }
        continue;
      }

      switch (agv.state) {
        case 'idle':
          if (agv.battery <= this.batteryConfig.chargeThreshold) this.requestChargeTask(agv);
          break;
        case 'to_pickup':
        case 'to_dropoff':
        case 'returning':
        case 'to_charge':
          this.advanceAlongRouteSafe(agv, dt);
          break;
        case 'waiting_pickup':
        case 'waiting_dropoff':
        case 'waiting_charge':
          agv.remainingSeconds -= dt;
          if (agv.remainingSeconds <= 0) this.transitionFromWaiting(agv);
          break;
        case 'loading':
        case 'unloading':
          agv.remainingSeconds -= dt;
          if (agv.remainingSeconds <= 0) {
            if (agv.state === 'loading') {
              agv.state = 'to_dropoff';
              agv.route = this.computeNextRoute(agv);
            } else {
              // The delivery is complete. Release the task before returning
              // so computeNextRoute targets the dedicated parking bay rather
              // than the already-served destination.
              agv.taskId = undefined;
              agv.pickupStationId = undefined;
              agv.targetStationId = undefined;
              if (agv.battery <= this.batteryConfig.chargeThreshold) {
                this.requestChargeTask(agv);
              } else {
                agv.state = 'returning';
                agv.route = this.computeNextRoute(agv);
              }
            }
            agv.remainingSeconds = 0;
          }
          break;
        case 'charging':
          agv.remainingSeconds -= dt;
          agv.battery += this.batteryConfig.chargeRatePerSecond * dt;
          if (agv.battery >= this.batteryConfig.chargeTarget) {
            agv.battery = this.batteryConfig.chargeTarget;
            agv.state = 'idle';
            agv.loadStatus = 'empty';
          }
          break;
      }
    }
  }

  private drainBattery(agv: AgvData, dt: number): void {
    let drainRate = 0;
    switch (agv.state) {
      case 'to_pickup':
      case 'to_dropoff':
      case 'returning':
      case 'to_charge':
        drainRate = this.batteryConfig.movingDrainPerSecond;
        break;
      case 'loading':
      case 'unloading':
        drainRate = this.batteryConfig.handlingDrainPerSecond;
        break;
      case 'idle':
        drainRate = this.batteryConfig.idleDrainPerSecond;
        break;
    }
    agv.battery = Math.max(0, agv.battery - drainRate * dt);
    if (agv.battery <= 5 && agv.state !== 'charging' && agv.state !== 'to_charge') {
      agv.state = 'to_charge';
      agv.route = this.computeRouteToNearestCharger(agv);
      agv.remainingSeconds = 5;
    }
  }

  // ============================================================
  // Collision detection
  // ============================================================

  private checkSpatialCollision(agv: AgvData, newX: number, newY: number): boolean {
    for (const other of this.agvs) {
      if (other.id === agv.id) continue;
      const currentDistance = dist(agv.position, other.position);
      const nextDistance = Math.sqrt(
        (other.position.x - newX) ** 2 + (other.position.y - newY) ** 2,
      );
      // Evaluate the next short movement step, not the next distant waypoint.
      // Otherwise AGVs sharing a future destination stop at departure.
      if (nextDistance < this.minAgvDistance && nextDistance < currentDistance - 0.01) return true;
    }
    return false;
  }

  private yieldForTraffic(agv: AgvData, seconds = 0.8): void {
    if (agv.state !== 'blocked' && agv.state !== 'fault') agv.resumeState = agv.state;
    agv.state = 'blocked';
    agv.isBlocked = true;
    agv.remainingSeconds = seconds;
  }

  private findWallCollision(x1: number, y1: number, x2: number, y2: number): string | null {
    for (const wall of this.wallObstacles) {
      if (
        lineIntersectsSegment(
          x1,
          y1,
          x2,
          y2,
          wall.x1,
          wall.y1,
          wall.x2,
          wall.y2,
          wall.hw + AGV_SWEPT_RADIUS,
        )
      )
        return wall.id;
    }
    return null;
  }

  private clampToBounds(agv: AgvData): void {
    const margin = 30;
    agv.position.x = Math.max(margin, Math.min(LAYOUT_W - margin, agv.position.x));
    agv.position.y = Math.max(margin, Math.min(LAYOUT_H - margin, agv.position.y));
  }

  private advanceAlongRouteSafe(agv: AgvData, dt: number): void {
    const holdUntil = this.trafficHoldUntil.get(agv.id) ?? 0;
    if (holdUntil > this.simTime) return;
    this.trafficHoldUntil.delete(agv.id);
    if (!agv.route || agv.route.length < 2) {
      this.arriveAtDestination(agv);
      return;
    }
    const speed = agv.loadStatus === 'loaded' ? this.config.loadedSpeed : this.config.emptySpeed;
    const travelDist = speed * dt * 60;
    let remaining = travelDist;

    while (remaining > 0 && agv.route.length >= 2) {
      const nextPt = agv.route[1];
      const seg = dist(agv.position, { x: nextPt[0], y: nextPt[1] });
      if (seg <= 0.01) {
        agv.route.shift();
        continue;
      }
      const step = Math.min(remaining, seg);
      const ratio = step / seg;
      const candidateX = agv.position.x + (nextPt[0] - agv.position.x) * ratio;
      const candidateY = agv.position.y + (nextPt[1] - agv.position.y) * ratio;
      const blockingWallId = this.findWallCollision(
        agv.position.x,
        agv.position.y,
        candidateX,
        candidateY,
      );
      if (blockingWallId) {
        this.yieldForTraffic(agv, 1.5);
        this.timeline.push({
          time: this.simTime,
          event: `${agv.id} 路径受 ${blockingWallId} 阻挡，等待重试`,
          type: 'fault',
          agvId: agv.id,
        });
        return;
      }
      if (this.checkSpatialCollision(agv, candidateX, candidateY)) {
        // A normal right-of-way wait is not a collision or equipment fault.
        // Keep the travelling state (and its route colour) while briefly
        // holding position, then retry on the following ticks.
        this.trafficHoldUntil.set(agv.id, this.simTime + 0.65);
        return;
      }
      if (seg <= remaining + 0.01) {
        agv.position = { x: nextPt[0], y: nextPt[1] };
        agv.route.shift();
        agv.totalDistance += seg;
        remaining = 0;
        this.recordMovement(agv.id);
        agv.isBlocked = false;
      } else {
        agv.position.x = candidateX;
        agv.position.y = candidateY;
        agv.totalDistance += step;
        remaining = 0;
        this.recordMovement(agv.id);
        agv.isBlocked = false;
      }
    }
    if (agv.route.length < 2) {
      this.arriveAtDestination(agv);
    }
    this.clampToBounds(agv);
  }

  private arriveAtDestination(agv: AgvData): void {
    switch (agv.state) {
      case 'to_pickup':
        agv.state = 'waiting_pickup';
        agv.remainingSeconds = this.config.loadUnloadDuration;
        this.timeline.push({
          time: this.simTime,
          event: `${agv.id} 到达取货点`,
          type: 'arrive',
          agvId: agv.id,
          taskId: agv.taskId,
        });
        this.activateArmForPickup(agv);
        break;
      case 'to_dropoff':
        agv.state = 'waiting_dropoff';
        agv.remainingSeconds = this.config.loadUnloadDuration;
        this.timeline.push({
          time: this.simTime,
          event: `${agv.id} 到达目标工位`,
          type: 'arrive',
          agvId: agv.id,
          taskId: agv.taskId,
        });
        break;
      case 'to_charge': {
        const charger = this.chargers.find((c) => c.id === agv.targetChargerId);
        if (charger && !charger.occupiedBy) {
          agv.state = 'charging';
          charger.occupiedBy = agv.id;
          charger.chargingProgress = 0;
          agv.remainingSeconds =
            (this.batteryConfig.chargeTarget - agv.battery) /
            this.batteryConfig.chargeRatePerSecond;
        } else if (charger) {
          agv.state = 'blocked';
          charger.queue.push(agv.id);
          agv.isBlocked = true;
          agv.remainingSeconds = 5;
        }
        break;
      }
      case 'returning':
        agv.state = 'idle';
        agv.route = [];
        break;
    }
  }

  // Compute the NEXT route based on the current sub-task chain
  private computeNextRoute(agv: AgvData): Array<[number, number]> {
    if (!agv.taskId) {
      // No task: return through the road network to this vehicle's own bay.
      return bfsPathOnNetwork(
        this.roadNetwork,
        agv.position,
        agv.homePosition ?? PARKING_BAYS[0],
        this.blockedEdges,
      );
    }

    // Find the current sub-task and compute route to its destination
    const subTask = this.subTasks.find((st) => st.id === agv.taskId);
    if (!subTask) return [];

    const destination = this.getNavigationPoint(subTask.destStationId);
    if (!destination) return [];

    return bfsPathOnNetwork(this.roadNetwork, agv.position, destination, this.blockedEdges);
  }

  private transitionFromWaiting(agv: AgvData): void {
    switch (agv.state) {
      case 'waiting_pickup': {
        agv.state = 'loading';
        agv.loadStatus = 'loaded';
        agv.remainingSeconds = this.config.loadUnloadDuration;
        if (agv.taskId) {
          const subTask = this.subTasks.find((st) => st.id === agv.taskId);
          if (subTask) {
            if (subTask.cargoId) {
              const cargo = this.cargos.find((c) => c.id === subTask.cargoId);
              if (cargo) {
                cargo.status = CargoStatus.ON_AGV;
                cargo.locationId = agv.id;
                cargo.subTaskId = subTask.id;
              }
            }
            subTask.status = 'running';
            subTask.startedAt = this.simTime;
          }
        }
        this.deactivateArm(agv);
        break;
      }
      case 'waiting_dropoff': {
        agv.state = 'unloading';
        agv.loadStatus = 'empty';
        agv.remainingSeconds = this.config.loadUnloadDuration;
        if (agv.taskId) {
          const subTask = this.subTasks.find((st) => st.id === agv.taskId);
          if (subTask) {
            if (subTask.cargoId) {
              const cargo = this.cargos.find(
                (c) => c.id === subTask.cargoId && c.locationId === agv.id,
              );
              if (cargo) {
                cargo.status = CargoStatus.AT_STATION;
                cargo.locationId = subTask.destStationId || 'UNKNOWN';
              }
            }
            subTask.progress = 1;
            subTask.status = 'completed';
            subTask.completedAt = this.simTime;
            this.metrics.completedTasks++;
            agv.completedTasks++;
            this.timeline.push({
              time: this.simTime,
              event: `${agv.id} 完成子任务 ${subTask.id}`,
              type: 'complete',
              agvId: agv.id,
              taskId: subTask.id,
            });
            const station = this.stations.find((s) => s.id === agv.targetStationId);
            if (station) {
              station.activeAgvId = undefined;
              station.activeTaskId = undefined;
              station.state = 'idle';
              station.queueLength = Math.max(0, station.queueLength - 1);
              station.totalProcessed++;
              this.setArmStateForStation(station.id, 'idle');
            }
          }
        }
        break;
      }
    }
  }

  private setArmStateForStation(
    stationId: string,
    armState: 'idle' | 'working',
    taskId?: string,
  ): void {
    for (const arm of this.arms) {
      if (arm.stationId === stationId) {
        arm.state = armState;
        arm.activeTaskId = taskId;
      }
    }
  }

  private activateArmForPickup(agv: AgvData): void {
    if (agv.taskId) {
      const subTask = this.subTasks.find((st) => st.id === agv.taskId);
      if (subTask?.sourceStationId) {
        const station = this.stations.find((s) => s.id === subTask.sourceStationId);
        if (station) {
          station.state = 'working';
          station.activeAgvId = agv.id;
          station.queueLength++;
          station.elapsedProcessing = 0;
          this.setArmStateForStation(station.id, 'working', subTask.id);
        }
      }
    }
  }

  private deactivateArm(agv: AgvData): void {
    if (agv.taskId) {
      const subTask = this.subTasks.find((st) => st.id === agv.taskId);
      if (subTask?.sourceStationId) this.setArmStateForStation(subTask.sourceStationId, 'idle');
    }
  }

  private requestChargeTask(agv: AgvData): void {
    const availableCharger = this.chargers.find((c) => !c.occupiedBy);
    if (!availableCharger) return;
    agv.taskType = 'charge';
    agv.targetChargerId = availableCharger.id;
    agv.route = this.computeRouteToNearestCharger(agv);
    agv.state = 'to_charge';
    agv.remainingSeconds = 0;
  }

  private computeRouteToNearestCharger(agv: AgvData): Array<[number, number]> {
    const nearest = this.chargers.reduce(
      (best, c) => (dist(agv.position, c.position) < dist(agv.position, best.position) ? c : best),
      this.chargers[0],
    );
    return bfsPathOnNetwork(this.roadNetwork, agv.position, nearest.position, this.blockedEdges);
  }

  private advanceStations(dt: number): void {
    for (const station of this.stations) {
      if (station.state === 'working' && station.activeTaskId && !station.activeAgvId) {
        station.elapsedProcessing += dt;
        if (station.elapsedProcessing >= station.processingTime) {
          const subTask = this.subTasks.find((item) => item.id === station.activeTaskId);
          if (subTask) {
            subTask.status = 'completed';
            subTask.progress = 1;
            subTask.completedAt = this.simTime;
            this.metrics.completedTasks++;
            this.timeline.push({
              time: this.simTime,
              event: `工位完成子任务 ${subTask.id}`,
              type: 'complete',
              taskId: subTask.id,
            });
          }
          station.elapsedProcessing = 0;
          station.totalProcessed++;
          station.state = 'idle';
          station.activeTaskId = undefined;
          this.setArmStateForStation(station.id, 'idle');
        }
        continue;
      }
      if (station.state === 'working' && station.activeAgvId) {
        station.elapsedProcessing += dt;
        if (station.elapsedProcessing >= station.processingTime) {
          const agv = this.agvs.find((a) => a.id === station.activeAgvId);
          if (agv && (agv.state === 'waiting_dropoff' || agv.state === 'waiting_pickup'))
            agv.remainingSeconds = 0;
          station.elapsedProcessing = 0;
          station.totalProcessed++;
          station.queueLength = Math.max(0, station.queueLength - 1);
          if (station.queueLength === 0) {
            station.state = 'idle';
            station.activeAgvId = undefined;
            station.activeTaskId = undefined;
          }
        }
      }
    }
  }

  private advanceChargers(_dt: number): void {
    for (const charger of this.chargers) {
      if (charger.occupiedBy) {
        const agv = this.agvs.find((a) => a.id === charger.occupiedBy);
        if (agv && agv.state === 'charging') {
          charger.chargingProgress = agv.battery;
        }
      }
    }
    this.metrics.activeChargers = this.chargers.filter((c) => !!c.occupiedBy).length;
  }

  private handleAnomalies(_dt: number): void {
    if (this.simTime >= this.nextFaultTime && !this.roadClosed && !this.orderSurge) {
      this.injectRandomFault();
      this.nextFaultTime = this.simTime + 40 + Math.random() * 30;
    }
  }

  private injectRandomFault(): void {
    const strategies = ['agv_fault', 'charger_fault', 'station_down'];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    switch (strategy) {
      case 'agv_fault': {
        const candidates = this.agvs.filter((a) => a.state !== 'idle' && a.state !== 'fault');
        if (candidates.length > 0) {
          const agv = candidates[Math.floor(Math.random() * candidates.length)];
          agv.state = 'fault';
          agv.faultRecoverySeconds = this.config.faultRecoveryDuration;
          this.metrics.faultCount++;
          this.timeline.push({
            time: this.simTime,
            event: `${agv.id} 发生故障`,
            type: 'fault',
            agvId: agv.id,
          });
        }
        break;
      }
      case 'charger_fault': {
        const charger = this.chargers[Math.floor(Math.random() * this.chargers.length)];
        if (charger) {
          charger.queue = [];
          this.timeline.push({
            time: this.simTime,
            event: `充电桩 ${charger.name} 故障`,
            type: 'fault',
          });
        }
        break;
      }
      case 'station_down': {
        const station = this.stations.filter((s) => s.state !== 'blocked')[
          Math.floor(Math.random() * this.stations.filter((s) => s.state !== 'blocked').length)
        ];
        if (station) {
          station.state = 'blocked';
          this.timeline.push({
            time: this.simTime,
            event: `工位 ${station.name} 停机`,
            type: 'fault',
          });
        }
        break;
      }
    }
  }

  private detectDeadlock(): void {
    const waitingAgvs = this.agvs.filter(
      (a) => a.state === 'waiting_pickup' || a.state === 'waiting_dropoff',
    );
    const stuckAgvs = waitingAgvs.filter(
      (a) => this.simTime - (this.lastMovementTime.get(a.id) ?? 0) > this.deadlockTimeout,
    );
    if (stuckAgvs.length >= 2 && !this.deadlockDetected) {
      this.deadlockDetected = true;
      const released = stuckAgvs[stuckAgvs.length - 1];
      released.state = 'blocked';
      released.route = [];
      released.isBlocked = true;
      released.remainingSeconds = 15;
      this.timeline.push({
        time: this.simTime,
        event: `${released.id} 死锁解除`,
        type: 'recover',
        agvId: released.id,
      });
      setTimeout(() => {
        this.deadlockDetected = false;
      }, 5000);
    }
  }

  private recordMovement(agvId: string): void {
    this.lastMovementTime.set(agvId, this.simTime);
  }

  private computeCongestion(): CongestionZone[] {
    const zones: CongestionZone[] = [];
    const channelCenters = [
      { x: 550, y: 340, r: 80 },
      { x: 550, y: 640, r: 80 },
      { x: 200, y: 500, r: 60 },
      { x: 1000, y: 500, r: 60 },
    ];
    for (const cc of channelCenters) {
      let count = 0;
      for (const agv of this.agvs) {
        if (dist(agv.position, cc) < cc.r) count++;
      }
      if (count >= 3) {
        const intensity = Math.min(1, count / 6);
        zones.push({
          x: cc.x,
          y: cc.y,
          radius: cc.r,
          intensity,
          avgWaitSeconds: Math.round(intensity * 20),
        });
      }
    }
    return zones;
  }

  private updateMetrics(): void {
    const totalAgvs = this.agvs.length;
    const activeAgvs = this.agvs.filter((a) => a.state !== 'idle' && a.state !== 'fault').length;
    this.metrics.utilization = totalAgvs > 0 ? activeAgvs / totalAgvs : 0;
  }

  private buildSnapshot(congestion: CongestionZone[]): SimulationSnapshot {
    return {
      currentTime: this.simTime,
      agvs: this.agvs.map((a) => ({ ...a })),
      stations: this.stations.map((s) => ({ ...s })),
      chargers: this.chargers.map((c) => ({ ...c })),
      zones: this.zones,
      buffers: this.buffers,
      arms: this.arms.map((a) => ({ ...a })),
      tasks: this.tasks.filter((t) => t.status !== 'completed').slice(-20),
      congestion,
      metrics: { ...this.metrics },
      timeline: this.timeline.slice(-30),
      cargos: this.cargos.slice(-30),
    };
  }

  injectRoadClosure(): void {
    this.roadClosed = true;
    // Block middle corridor edges
    this.blockedEdges.clear();
    for (const [id, edge] of this.roadNetwork.edges) {
      if (edge.from.startsWith('N-M') || edge.to.startsWith('N-M')) {
        this.blockedEdges.add(id);
        edge.isBlocked = true;
      }
    }
    this.timeline.push({ time: this.simTime, event: '道路封锁：中间通道', type: 'fault' });
  }

  injectOrderSurge(): void {
    this.orderSurge = true;
    this.orderSurgeUntil = this.simTime + 30;
    this.timeline.push({ time: this.simTime, event: '订单激增', type: 'fault' });
  }
  injectStationDown(stationId: string): void {
    const station = this.stations.find((s) => s.id === stationId);
    if (station) {
      station.state = 'blocked';
      this.timeline.push({ time: this.simTime, event: `工位 ${station.name} 停机`, type: 'fault' });
    }
  }
  injectAgvFault(agvId: string): void {
    const agv = this.agvs.find((a) => a.id === agvId);
    if (agv && agv.state !== 'fault') {
      agv.state = 'fault';
      agv.faultRecoverySeconds = this.config.faultRecoveryDuration;
      this.metrics.faultCount++;
      this.timeline.push({ time: this.simTime, event: `AGV ${agvId} 故障`, type: 'fault', agvId });
    }
  }
  injectChargerFault(chargerId: string): void {
    const charger = this.chargers.find((c) => c.id === chargerId);
    if (charger) {
      charger.queue = [];
      this.timeline.push({
        time: this.simTime,
        event: `充电桩 ${charger.name} 故障`,
        type: 'fault',
      });
    }
  }

  reset(): void {
    this.simTime = 0;
    this.orderTimer = 0;
    this.nextOrderId = 0;
    this.nextSubTaskId = 0;
    this.nextFaultTime = 40 + Math.random() * 30;
    this.metrics = {
      completedTasks: 0,
      averageWaitSeconds: 0,
      utilization: 0,
      congestionScore: 0,
      totalOrdersGenerated: 0,
      activeChargers: 0,
      faultCount: 0,
    };
    this.tasks = [];
    this.subTasks = [];
    this.timeline = [];
    this.cargos = [];
    this.nextCargoId = 0;
    this.roadClosed = false;
    this.orderSurge = false;
    this.deadlockDetected = false;
    this.blockedEdges.clear();
    this.lastMovementTime.clear();
    this.trafficHoldUntil.clear();
    for (const edge of this.roadNetwork.edges.values()) edge.isBlocked = false;
    this.initWorld();
  }

  getConfig(): SimulationConfig {
    return this.config;
  }
  getSimTime(): number {
    return this.simTime;
  }
  getWarehouseConfig(): WarehouseConfig {
    return this.warehouseConfig;
  }
  getRoadNetwork(): RoadNetwork {
    return this.roadNetwork;
  }
  getSubTasks(): SubTask[] {
    return this.subTasks;
  }
}
