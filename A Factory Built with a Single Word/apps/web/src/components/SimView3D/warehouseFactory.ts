/**
 * Warehouse Layout Factory — Complete Digital Twin Design
 *
 * Architecture:
 * - Real factory shell: exterior walls, interior partitions, columns, roof beams
 * - Doors: rolling shutters (recv/ship), personnel doors, fire exits
 * - Platforms: receiving dock, shipping dock with dock levelers
 * - Zones with clear logistics flow
 * - Lane-separated road network with one-way corridors
 * - Safety envelopes: AGV no-go zones, charger high-voltage areas, arm work envelopes
 * - Stacker cranes for high-bay, arms for low-bay stations
 */

import type {
  WarehouseConfig,
  WarehouseZone,
  ShelfZone,
  RoadNetwork,
  RoadNode,
  RoadEdge,
  WallSegment,
  Door,
  Point2D,
  Column,
} from './digitalTwin';
import { ZoneType, WallType, DoorType, RoadDirection } from './digitalTwin';

// ============================================================
// Constants
// ============================================================

const LAYOUT_W = 1200;
const LAYOUT_H = 1000;
const WALL_THICKNESS = 10;
const COLUMN_SIZE = 8;
const BEAM_HEIGHT = 7.5;

// ============================================================
// Zones — complete warehouse flow
// ============================================================

function createZones(): WarehouseZone[] {
  return [
    // === RECV SIDE (left) ===
    {
      id: 'ZONE-RECV',
      name: '收货月台',
      type: ZoneType.RECV_DOCK,
      bounds: { x: 5, y: 300, w: 80, h: 400 },
      color: '#f59e0b',
    },
    {
      id: 'ZONE-QC',
      name: '质检区',
      type: ZoneType.QC_AREA,
      bounds: { x: 95, y: 350, w: 60, h: 300 },
      color: '#a855f7',
    },
    {
      id: 'ZONE-INBUF',
      name: '入库缓冲区',
      type: ZoneType.INBOUND_BUFFER,
      bounds: { x: 165, y: 380, w: 70, h: 240 },
      color: '#ec4899',
    },

    // === HIGH-BAY STORAGE (top) ===
    {
      id: 'ZONE-HBA',
      name: '高位存储 A',
      type: ZoneType.HIGH_BAY_STORAGE,
      bounds: { x: 250, y: 20, w: 260, h: 360 },
      color: '#3b82f6',
    },
    {
      id: 'ZONE-HBB',
      name: '高位存储 B',
      type: ZoneType.HIGH_BAY_STORAGE,
      bounds: { x: 530, y: 20, w: 260, h: 360 },
      color: '#22c55e',
    },

    // === LOW-BAY OPERATIONS (center) ===
    {
      id: 'ZONE-PICK',
      name: '拣选区',
      type: ZoneType.PICK_ZONE,
      bounds: { x: 250, y: 400, w: 160, h: 160 },
      color: '#f97316',
    },
    {
      id: 'ZONE-SORT',
      name: '分拣区',
      type: ZoneType.SORTING_ZONE,
      bounds: { x: 430, y: 420, w: 70, h: 140 },
      color: '#14b8a6',
    },
    {
      id: 'ZONE-PACK',
      name: '打包区',
      type: ZoneType.PACK_ZONE,
      bounds: { x: 520, y: 400, w: 160, h: 160 },
      color: '#ef4444',
    },

    // === OUTBOUND SIDE (right) ===
    {
      id: 'ZONE-OUTBUF',
      name: '出库缓冲区',
      type: ZoneType.OUTBOUND_BUFFER,
      bounds: { x: 280, y: 600, w: 100, h: 100 },
      color: '#6366f1',
    },
    {
      id: 'ZONE-SHIP',
      name: '发货月台',
      type: ZoneType.SHIP_DOCK,
      bounds: { x: 1105, y: 300, w: 90, h: 400 },
      color: '#84cc16',
    },

    // === SUPPORT ZONES (bottom) ===
    {
      id: 'ZONE-CHARGE',
      name: '充电区',
      type: ZoneType.CHARGE_ZONE,
      bounds: { x: 280, y: 780, w: 180, h: 100 },
      color: '#64748b',
    },
    {
      id: 'ZONE-MAINT',
      name: '维修区',
      type: ZoneType.MAINTENANCE,
      bounds: { x: 900, y: 780, w: 160, h: 100 },
      color: '#78716c',
    },
  ];
}

// ============================================================
// Shelf zones with proper aisles and levels
// ============================================================

function createShelfZones(): ShelfZone[] {
  const aislesA: ShelfZone['aisles'] = [];
  for (let i = 0; i < 4; i++) {
    aislesA.push({
      aisleId: `AISLE-A${i + 1}`,
      zoneId: 'ZONE-HBA',
      levels: [
        {
          level: 1,
          height: 0.5,
          slots: Array.from({ length: 8 }, (_, j) => ({
            slotId: `A-${i + 1}-L1-${j + 1}`,
            position: j + 1,
            occupancy: Math.random() * 0.8 + 0.2,
            maxWeight: 500,
          })),
        },
        {
          level: 2,
          height: 1.8,
          slots: Array.from({ length: 8 }, (_, j) => ({
            slotId: `A-${i + 1}-L2-${j + 1}`,
            position: j + 1,
            occupancy: Math.random() * 0.7 + 0.3,
            maxWeight: 500,
          })),
        },
        {
          level: 3,
          height: 3.1,
          slots: Array.from({ length: 8 }, (_, j) => ({
            slotId: `A-${i + 1}-L3-${j + 1}`,
            position: j + 1,
            occupancy: Math.random() * 0.6 + 0.2,
            maxWeight: 400,
          })),
        },
        {
          level: 4,
          height: 4.4,
          slots: Array.from({ length: 8 }, (_, j) => ({
            slotId: `A-${i + 1}-L4-${j + 1}`,
            position: j + 1,
            occupancy: Math.random() * 0.5 + 0.2,
            maxWeight: 300,
          })),
        },
      ],
      length: 240,
      width: 45,
    });
  }

  const aislesB: ShelfZone['aisles'] = [];
  for (let i = 0; i < 4; i++) {
    aislesB.push({
      aisleId: `AISLE-B${i + 1}`,
      zoneId: 'ZONE-HBB',
      levels: [
        {
          level: 1,
          height: 0.5,
          slots: Array.from({ length: 8 }, (_, j) => ({
            slotId: `B-${i + 1}-L1-${j + 1}`,
            position: j + 1,
            occupancy: Math.random() * 0.7 + 0.3,
            maxWeight: 500,
          })),
        },
        {
          level: 2,
          height: 1.8,
          slots: Array.from({ length: 8 }, (_, j) => ({
            slotId: `B-${i + 1}-L2-${j + 1}`,
            position: j + 1,
            occupancy: Math.random() * 0.6 + 0.4,
            maxWeight: 500,
          })),
        },
        {
          level: 3,
          height: 3.1,
          slots: Array.from({ length: 8 }, (_, j) => ({
            slotId: `B-${i + 1}-L3-${j + 1}`,
            position: j + 1,
            occupancy: Math.random() * 0.5 + 0.2,
            maxWeight: 400,
          })),
        },
        {
          level: 4,
          height: 4.4,
          slots: Array.from({ length: 8 }, (_, j) => ({
            slotId: `B-${i + 1}-L4-${j + 1}`,
            position: j + 1,
            occupancy: Math.random() * 0.4 + 0.2,
            maxWeight: 300,
          })),
        },
      ],
      length: 240,
      width: 45,
    });
  }

  return [
    {
      zoneId: 'ZONE-HBA',
      name: '高位存储 A',
      type: 'high-bay',
      aisles: aislesA,
      position: { x: 270, y: 50 },
      dimensions: { w: 260, h: 360, d: 160 },
    },
    {
      zoneId: 'ZONE-HBB',
      name: '高位存储 B',
      type: 'high-bay',
      aisles: aislesB,
      position: { x: 550, y: 50 },
      dimensions: { w: 260, h: 360, d: 160 },
    },
  ];
}

// ============================================================
// Walls — factory shell with openings for doors
// ============================================================

function createWalls(): WallSegment[] {
  // The pallet AMR has a 60 × 51 layout-unit envelope.  The 80-unit paired
  // lanes below therefore need a 120-unit clear opening, while a cross-aisle
  // needs at least 160 units.  These are physical vehicle passages, not
  // decorative gaps in the wall mesh.
  return [
    // Exterior walls (with gaps for doors)
    {
      id: 'W-EXT-1',
      type: WallType.EXTERIOR,
      start: { x: 5, y: 5 },
      end: { x: 1195, y: 5 },
      height: BEAM_HEIGHT,
    },
    {
      id: 'W-EXT-2A',
      type: WallType.EXTERIOR,
      start: { x: 1195, y: 5 },
      end: { x: 1195, y: 440 },
      height: BEAM_HEIGHT,
    },
    {
      id: 'W-EXT-2B',
      type: WallType.EXTERIOR,
      start: { x: 1195, y: 560 },
      end: { x: 1195, y: 995 },
      height: BEAM_HEIGHT,
    },
    {
      id: 'W-EXT-4',
      type: WallType.EXTERIOR,
      start: { x: 1195, y: 995 },
      end: { x: 5, y: 995 },
      height: BEAM_HEIGHT,
    },
    {
      id: 'W-EXT-5A',
      type: WallType.EXTERIOR,
      start: { x: 5, y: 995 },
      end: { x: 5, y: 560 },
      height: BEAM_HEIGHT,
    },
    {
      id: 'W-EXT-5B',
      type: WallType.EXTERIOR,
      start: { x: 5, y: 440 },
      end: { x: 5, y: 5 },
      height: BEAM_HEIGHT,
    },
  ];
}

// ============================================================
// Doors
// ============================================================

function createDoors(): Door[] {
  return [
    {
      id: 'DOOR-RECV',
      type: DoorType.ROLLING_SHUTTER,
      position: { x: 5, y: 500 },
      width: 120,
      isOpen: true,
      relatedZoneId: 'ZONE-RECV',
    },
    {
      id: 'DOOR-SHIP',
      type: DoorType.ROLLING_SHUTTER,
      position: { x: 1195, y: 500 },
      width: 120,
      isOpen: true,
      relatedZoneId: 'ZONE-SHIP',
    },
    {
      id: 'DOOR-PERSONNEL-1',
      type: DoorType.PERSONNEL,
      position: { x: 120, y: 5 },
      width: 10,
      isOpen: true,
    },
    {
      id: 'DOOR-PERSONNEL-2',
      type: DoorType.PERSONNEL,
      position: { x: 1080, y: 5 },
      width: 10,
      isOpen: true,
    },
    {
      id: 'DOOR-FIRE-1',
      type: DoorType.FIRE_EXIT,
      position: { x: 600, y: 995 },
      width: 18,
      isOpen: false,
    },
  ];
}

// ============================================================
// Columns — structural grid
// ============================================================

function createColumns(): Column[] {
  const cols: Column[] = [];
  // Grid: every 200 units horizontally and vertically
  for (let x = 200; x <= 1000; x += 200) {
    for (let y = 200; y <= 800; y += 200) {
      // Skip columns inside shelf zones
      const inShelfA = x >= 250 && x <= 510 && y >= 20 && y <= 380;
      const inShelfB = x >= 530 && x <= 790 && y >= 20 && y <= 380;
      if (inShelfA || inShelfB) continue;
      cols.push({
        id: `COL-${cols.length + 1}`,
        position: { x, y },
        size: COLUMN_SIZE,
        height: BEAM_HEIGHT,
      });
    }
  }
  return cols;
}

// ============================================================
// Beams — roof structure
// ============================================================

function createBeams(): { id: string; start: Point2D; end: Point2D; height: number }[] {
  const beams: { id: string; start: Point2D; end: Point2D; height: number }[] = [];
  // Longitudinal beams
  for (let y = 100; y <= 900; y += 200) {
    beams.push({
      id: `BEAM-L${Math.round(y / 200)}`,
      start: { x: 5, y },
      end: { x: 1195, y },
      height: BEAM_HEIGHT,
    });
  }
  return beams;
}

// ============================================================
// Road Network — lane-separated with one-way corridors
// ============================================================

function createRoadNetwork(): RoadNetwork {
  const nodes: Map<string, RoadNode> = new Map();
  const edges: Map<string, RoadEdge> = new Map();
  const adjacency: Map<string, string[]> = new Map();

  const nodeDefs: Array<{ id: string; pos: Point2D; type: RoadNode['type'] }> = [
    // Top corridor — inbound lane (north side)
    { id: 'N-TIN1', pos: { x: 100, y: 35 }, type: 'junction' },
    { id: 'N-TIN2', pos: { x: 300, y: 35 }, type: 'junction' },
    { id: 'N-TIN3', pos: { x: 500, y: 35 }, type: 'junction' },
    { id: 'N-TIN4', pos: { x: 700, y: 35 }, type: 'junction' },
    { id: 'N-TIN5', pos: { x: 900, y: 35 }, type: 'junction' },
    // Top corridor — outbound lane (south side)
    { id: 'N-TOUT1', pos: { x: 100, y: 55 }, type: 'junction' },
    { id: 'N-TOUT2', pos: { x: 300, y: 55 }, type: 'junction' },
    { id: 'N-TOUT3', pos: { x: 500, y: 55 }, type: 'junction' },
    { id: 'N-TOUT4', pos: { x: 700, y: 55 }, type: 'junction' },
    { id: 'N-TOUT5', pos: { x: 900, y: 55 }, type: 'junction' },
    // Middle corridor — inbound
    { id: 'N-MIN1', pos: { x: 100, y: 330 }, type: 'junction' },
    { id: 'N-MIN2', pos: { x: 300, y: 330 }, type: 'junction' },
    { id: 'N-MIN3', pos: { x: 500, y: 330 }, type: 'junction' },
    { id: 'N-MIN4', pos: { x: 700, y: 330 }, type: 'junction' },
    { id: 'N-MIN5', pos: { x: 900, y: 330 }, type: 'junction' },
    { id: 'N-MIN6', pos: { x: 1100, y: 330 }, type: 'junction' },
    // Middle corridor — outbound
    { id: 'N-MOUT1', pos: { x: 100, y: 350 }, type: 'junction' },
    { id: 'N-MOUT2', pos: { x: 300, y: 350 }, type: 'junction' },
    { id: 'N-MOUT3', pos: { x: 500, y: 350 }, type: 'junction' },
    { id: 'N-MOUT4', pos: { x: 700, y: 350 }, type: 'junction' },
    { id: 'N-MOUT5', pos: { x: 900, y: 350 }, type: 'junction' },
    { id: 'N-MOUT6', pos: { x: 1100, y: 350 }, type: 'junction' },
    // Bottom corridor — inbound
    { id: 'N-BIN1', pos: { x: 100, y: 630 }, type: 'junction' },
    { id: 'N-BIN2', pos: { x: 300, y: 630 }, type: 'junction' },
    { id: 'N-BIN3', pos: { x: 500, y: 630 }, type: 'junction' },
    { id: 'N-BIN4', pos: { x: 700, y: 630 }, type: 'junction' },
    { id: 'N-BIN5', pos: { x: 900, y: 630 }, type: 'junction' },
    { id: 'N-BIN6', pos: { x: 1100, y: 630 }, type: 'junction' },
    // Bottom corridor — outbound
    { id: 'N-BOUT1', pos: { x: 100, y: 650 }, type: 'junction' },
    { id: 'N-BOUT2', pos: { x: 300, y: 650 }, type: 'junction' },
    { id: 'N-BOUT3', pos: { x: 500, y: 650 }, type: 'junction' },
    { id: 'N-BOUT4', pos: { x: 700, y: 650 }, type: 'junction' },
    { id: 'N-BOUT5', pos: { x: 900, y: 650 }, type: 'junction' },
    { id: 'N-BOUT6', pos: { x: 1100, y: 650 }, type: 'junction' },
    // Deep corridor
    { id: 'N-D1', pos: { x: 100, y: 880 }, type: 'junction' },
    { id: 'N-D2', pos: { x: 300, y: 880 }, type: 'junction' },
    { id: 'N-D3', pos: { x: 500, y: 880 }, type: 'junction' },
    { id: 'N-D4', pos: { x: 700, y: 880 }, type: 'junction' },
    { id: 'N-D5', pos: { x: 900, y: 880 }, type: 'junction' },
    { id: 'N-D6', pos: { x: 1100, y: 880 }, type: 'junction' },
    // Vertical connectors
    // Connector columns share the exact x coordinate of their corridor node.
    // The previous 100-unit x offset produced diagonal shortcuts through racks.
    { id: 'N-V1', pos: { x: 100, y: 35 }, type: 'junction' },
    { id: 'N-V2', pos: { x: 100, y: 330 }, type: 'junction' },
    { id: 'N-V3', pos: { x: 100, y: 630 }, type: 'junction' },
    { id: 'N-V4', pos: { x: 100, y: 880 }, type: 'junction' },
    { id: 'N-V5', pos: { x: 300, y: 35 }, type: 'junction' },
    { id: 'N-V6', pos: { x: 300, y: 330 }, type: 'junction' },
    { id: 'N-V7', pos: { x: 300, y: 630 }, type: 'junction' },
    { id: 'N-V8', pos: { x: 300, y: 880 }, type: 'junction' },
    { id: 'N-V9', pos: { x: 500, y: 35 }, type: 'station_entry' },
    { id: 'N-V10', pos: { x: 500, y: 330 }, type: 'station_entry' },
    { id: 'N-V11', pos: { x: 500, y: 630 }, type: 'junction' },
    { id: 'N-V12', pos: { x: 500, y: 880 }, type: 'junction' },
    { id: 'N-V13', pos: { x: 700, y: 35 }, type: 'junction' },
    { id: 'N-V14', pos: { x: 700, y: 330 }, type: 'junction' },
    { id: 'N-V15', pos: { x: 700, y: 630 }, type: 'junction' },
    { id: 'N-V16', pos: { x: 700, y: 880 }, type: 'junction' },
    { id: 'N-V17', pos: { x: 900, y: 35 }, type: 'junction' },
    { id: 'N-V18', pos: { x: 900, y: 330 }, type: 'junction' },
    { id: 'N-V19', pos: { x: 900, y: 630 }, type: 'junction' },
    { id: 'N-V20', pos: { x: 900, y: 880 }, type: 'junction' },
    // Charger entries
    { id: 'N-CHG1', pos: { x: 330, y: 810 }, type: 'charger_entry' },
    { id: 'N-CHG2', pos: { x: 410, y: 810 }, type: 'charger_entry' },
    // Buffer entries
    { id: 'N-BUF-IN', pos: { x: 400, y: 760 }, type: 'buffer_entry' },
    { id: 'N-BUF-OUT', pos: { x: 800, y: 760 }, type: 'buffer_entry' },
  ];

  // Keep the layout data compact above, then enforce the real lane spacing in
  // one place.  The previous 20-unit lane spacing was narrower than one AMR,
  // so two vehicles were guaranteed to overlap even on a correct route.
  const laneYByLegacyY: Record<number, number> = {
    35: 80,
    55: 180,
    330: 300,
    350: 400,
    630: 650,
    650: 750,
    880: 920,
  };
  for (const node of nodeDefs) {
    const adjustedY = laneYByLegacyY[node.pos.y];
    if (adjustedY !== undefined) node.pos = { ...node.pos, y: adjustedY };
  }

  for (const nd of nodeDefs) {
    nodes.set(nd.id, { id: nd.id, position: nd.pos, type: nd.type, reservationTable: [] });
    adjacency.set(nd.id, []);
  }

  const edgePairs: Array<[string, string, RoadDirection, number]> = [
    // Top corridor inbound
    ['N-TIN1', 'N-TIN2', RoadDirection.BIDIRECTIONAL, 200],
    ['N-TIN2', 'N-TIN3', RoadDirection.BIDIRECTIONAL, 200],
    ['N-TIN3', 'N-TIN4', RoadDirection.BIDIRECTIONAL, 200],
    ['N-TIN4', 'N-TIN5', RoadDirection.BIDIRECTIONAL, 200],
    // Top corridor outbound
    ['N-TOUT1', 'N-TOUT2', RoadDirection.BIDIRECTIONAL, 200],
    ['N-TOUT2', 'N-TOUT3', RoadDirection.BIDIRECTIONAL, 200],
    ['N-TOUT3', 'N-TOUT4', RoadDirection.BIDIRECTIONAL, 200],
    ['N-TOUT4', 'N-TOUT5', RoadDirection.BIDIRECTIONAL, 200],
    // Lane bridges top
    ['N-TIN1', 'N-TOUT1', RoadDirection.BIDIRECTIONAL, 20],
    ['N-TIN2', 'N-TOUT2', RoadDirection.BIDIRECTIONAL, 20],
    ['N-TIN3', 'N-TOUT3', RoadDirection.BIDIRECTIONAL, 20],
    ['N-TIN4', 'N-TOUT4', RoadDirection.BIDIRECTIONAL, 20],
    ['N-TIN5', 'N-TOUT5', RoadDirection.BIDIRECTIONAL, 20],
    // Middle corridor inbound
    ['N-MIN1', 'N-MIN2', RoadDirection.BIDIRECTIONAL, 200],
    ['N-MIN2', 'N-MIN3', RoadDirection.BIDIRECTIONAL, 200],
    ['N-MIN3', 'N-MIN4', RoadDirection.BIDIRECTIONAL, 200],
    ['N-MIN4', 'N-MIN5', RoadDirection.BIDIRECTIONAL, 200],
    ['N-MIN5', 'N-MIN6', RoadDirection.BIDIRECTIONAL, 200],
    // Middle corridor outbound
    ['N-MOUT1', 'N-MOUT2', RoadDirection.BIDIRECTIONAL, 200],
    ['N-MOUT2', 'N-MOUT3', RoadDirection.BIDIRECTIONAL, 200],
    ['N-MOUT3', 'N-MOUT4', RoadDirection.BIDIRECTIONAL, 200],
    ['N-MOUT4', 'N-MOUT5', RoadDirection.BIDIRECTIONAL, 200],
    ['N-MOUT5', 'N-MOUT6', RoadDirection.BIDIRECTIONAL, 200],
    // Lane bridges middle
    ['N-MIN1', 'N-MOUT1', RoadDirection.BIDIRECTIONAL, 20],
    ['N-MIN2', 'N-MOUT2', RoadDirection.BIDIRECTIONAL, 20],
    ['N-MIN3', 'N-MOUT3', RoadDirection.BIDIRECTIONAL, 20],
    ['N-MIN4', 'N-MOUT4', RoadDirection.BIDIRECTIONAL, 20],
    ['N-MIN5', 'N-MOUT5', RoadDirection.BIDIRECTIONAL, 20],
    ['N-MIN6', 'N-MOUT6', RoadDirection.BIDIRECTIONAL, 20],
    // Bottom corridor inbound
    ['N-BIN1', 'N-BIN2', RoadDirection.BIDIRECTIONAL, 200],
    ['N-BIN2', 'N-BIN3', RoadDirection.BIDIRECTIONAL, 200],
    ['N-BIN3', 'N-BIN4', RoadDirection.BIDIRECTIONAL, 200],
    ['N-BIN4', 'N-BIN5', RoadDirection.BIDIRECTIONAL, 200],
    ['N-BIN5', 'N-BIN6', RoadDirection.BIDIRECTIONAL, 200],
    // Bottom corridor outbound
    ['N-BOUT1', 'N-BOUT2', RoadDirection.BIDIRECTIONAL, 200],
    ['N-BOUT2', 'N-BOUT3', RoadDirection.BIDIRECTIONAL, 200],
    ['N-BOUT3', 'N-BOUT4', RoadDirection.BIDIRECTIONAL, 200],
    ['N-BOUT4', 'N-BOUT5', RoadDirection.BIDIRECTIONAL, 200],
    ['N-BOUT5', 'N-BOUT6', RoadDirection.BIDIRECTIONAL, 200],
    // Lane bridges bottom
    ['N-BIN1', 'N-BOUT1', RoadDirection.BIDIRECTIONAL, 20],
    ['N-BIN2', 'N-BOUT2', RoadDirection.BIDIRECTIONAL, 20],
    ['N-BIN3', 'N-BOUT3', RoadDirection.BIDIRECTIONAL, 20],
    ['N-BIN4', 'N-BOUT4', RoadDirection.BIDIRECTIONAL, 20],
    ['N-BIN5', 'N-BOUT5', RoadDirection.BIDIRECTIONAL, 20],
    ['N-BIN6', 'N-BOUT6', RoadDirection.BIDIRECTIONAL, 20],
    // Deep corridor
    ['N-D1', 'N-D2', RoadDirection.BIDIRECTIONAL, 200],
    ['N-D2', 'N-D3', RoadDirection.BIDIRECTIONAL, 200],
    ['N-D3', 'N-D4', RoadDirection.BIDIRECTIONAL, 200],
    ['N-D4', 'N-D5', RoadDirection.BIDIRECTIONAL, 200],
    ['N-D5', 'N-D6', RoadDirection.BIDIRECTIONAL, 200],
    // Vertical connectors
    ['N-TIN1', 'N-V1', RoadDirection.BIDIRECTIONAL, 0],
    ['N-V1', 'N-MIN1', RoadDirection.BIDIRECTIONAL, 300],
    ['N-MIN1', 'N-V3', RoadDirection.BIDIRECTIONAL, 300],
    ['N-V3', 'N-BIN1', RoadDirection.BIDIRECTIONAL, 250],
    ['N-BIN1', 'N-D1', RoadDirection.BIDIRECTIONAL, 250],
    ['N-TIN2', 'N-V5', RoadDirection.BIDIRECTIONAL, 0],
    ['N-V5', 'N-V7', RoadDirection.BIDIRECTIONAL, 300],
    ['N-V7', 'N-V8', RoadDirection.BIDIRECTIONAL, 250],
    ['N-V8', 'N-D2', RoadDirection.BIDIRECTIONAL, 0],
    ['N-TIN3', 'N-V9', RoadDirection.BIDIRECTIONAL, 0],
    ['N-V9', 'N-V11', RoadDirection.BIDIRECTIONAL, 300],
    ['N-V11', 'N-V12', RoadDirection.BIDIRECTIONAL, 250],
    ['N-V12', 'N-D3', RoadDirection.BIDIRECTIONAL, 0],
    ['N-TIN4', 'N-V13', RoadDirection.BIDIRECTIONAL, 0],
    ['N-V13', 'N-V15', RoadDirection.BIDIRECTIONAL, 300],
    ['N-V15', 'N-V16', RoadDirection.BIDIRECTIONAL, 250],
    ['N-V16', 'N-D4', RoadDirection.BIDIRECTIONAL, 0],
    ['N-TIN5', 'N-V17', RoadDirection.BIDIRECTIONAL, 0],
    ['N-V17', 'N-V19', RoadDirection.BIDIRECTIONAL, 300],
    ['N-V19', 'N-D5', RoadDirection.BIDIRECTIONAL, 250],
    // Charger connections
    ['N-CHG1', 'N-D2', RoadDirection.BIDIRECTIONAL, 70],
    ['N-CHG2', 'N-D3', RoadDirection.BIDIRECTIONAL, 70],
    // Buffer connections
    ['N-BUF-IN', 'N-V8', RoadDirection.BIDIRECTIONAL, 120],
    ['N-BUF-OUT', 'N-V16', RoadDirection.BIDIRECTIONAL, 120],
  ];

  let edgeIdx = 0;
  for (const [fromId, toId, dir, len] of edgePairs) {
    const fromNode = nodes.get(fromId)!;
    const toNode = nodes.get(toId)!;
    const actualLen =
      len > 0
        ? len
        : Math.sqrt(
            (fromNode.position.x - toNode.position.x) ** 2 +
              (fromNode.position.y - toNode.position.y) ** 2,
          );
    const eastbound = ['N-TIN', 'N-MIN', 'N-BIN', 'N-D'];
    const westbound = ['N-TOUT', 'N-MOUT', 'N-BOUT'];
    const effectiveDirection = eastbound.some(
      (prefix) => fromId.startsWith(prefix) && toId.startsWith(prefix),
    )
      ? RoadDirection.ONE_WAY_A_TO_B
      : westbound.some((prefix) => fromId.startsWith(prefix) && toId.startsWith(prefix))
        ? RoadDirection.ONE_WAY_B_TO_A
        : dir;

    if (effectiveDirection !== RoadDirection.ONE_WAY_B_TO_A) {
      const edgeIdF = `E-${++edgeIdx}`;
      edges.set(edgeIdF, {
        id: edgeIdF,
        from: fromId,
        to: toId,
        direction: effectiveDirection,
        length: actualLen,
        speedLimit: 1.2,
        capacity: 1,
        currentOccupants: [],
        isBlocked: false,
      });
      adjacency.get(fromId)!.push(toId);
    }
    if (effectiveDirection !== RoadDirection.ONE_WAY_A_TO_B) {
      const edgeIdB = `E-${++edgeIdx}`;
      edges.set(edgeIdB, {
        id: edgeIdB,
        from: toId,
        to: fromId,
        direction: effectiveDirection,
        length: actualLen,
        speedLimit: 1.2,
        capacity: 1,
        currentOccupants: [],
        isBlocked: false,
      });
      adjacency.get(toId)!.push(fromId);
    }
  }

  return { nodes, edges, adjacency };
}

// ============================================================
// Safety areas
// ============================================================

function createSafetyAreas(): Array<{ x: number; y: number; w: number; h: number }> {
  return [
    { x: 240, y: 400, w: 180, h: 180 }, // Pick zone safety
    { x: 170, y: 770, w: 200, h: 120 }, // Charger high-voltage
    { x: 890, y: 770, w: 180, h: 120 }, // Maintenance exclusion
  ];
}

// ============================================================
// Export
// ============================================================

export function createWarehouseConfig(): WarehouseConfig {
  return {
    width: LAYOUT_W,
    height: LAYOUT_H,
    ceilingHeight: BEAM_HEIGHT,
    wallThickness: WALL_THICKNESS,
    zones: createZones(),
    shelfZones: createShelfZones(),
    roadNetwork: createRoadNetwork(),
    doors: createDoors(),
    walls: createWalls(),
    safetyAreas: createSafetyAreas(),
    columns: createColumns(),
    beams: createBeams(),
  };
}
