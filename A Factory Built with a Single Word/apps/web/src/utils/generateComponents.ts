/**
 * Requirement → SceneComponent[] generator
 *
 * Typed device counts + collision-free layout + auto-retry canvas expansion.
 */
import type { SceneComponent } from '@ican/contracts';

// ============================================================
// Types
// ============================================================

export interface DeviceCounts {
  shelves: number;
  agvs: { tote: number; pallet: number };
  arms: number;
  conveyors: number;
  stations: { pick: number; pack: number; sort: number };
  chargers: number;
}

export interface IndustryExample {
  key: string; name: string; description: string;
  requirement: string; cover: string; counts: DeviceCounts;
}

interface Rect { x: number; y: number; width: number; height: number; }

// ============================================================
// Chinese numeral
// ============================================================

const CN_NUM: Record<string, number> = { '一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15,'十六':16,'十七':17,'十八':18,'十九':19,'二十':20 };
function cn(s: string): number | null { return CN_NUM[s] ?? (Number.isNaN(+s) ? null : +s); }

// ============================================================
// Parsing — exact types first, then general remainder
// ============================================================

function countExact(text: string, re: RegExp): number {
  let sum = 0; let m: RegExpExecArray | null;
  const r = new RegExp(re);
  while ((m = r.exec(text)) !== null) { const n = cn(m[1]); if (n && n > 0 && n <= 200) sum += n; }
  return sum;
}

/** Remove already-matched substrings so general regex doesn't double-count */
function removeMatched(text: string, re: RegExp): string {
  return text.replace(new RegExp(re.source, 'gi'), '');
}

export function parseRequirementForDevices(requirement: string): DeviceCounts {
  let remaining = requirement.toLowerCase();
  const orig = remaining;

  // 1. Exact types — parse and consume from text
  const toteAGV = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*台?\s*料箱\s*agv/gi);
  remaining = removeMatched(remaining, /(\d+|[一二两三四五六七八九十]+)\s*台?\s*料箱\s*agv/gi);

  const palletAGV = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*台?\s*托盘\s*(?:agv|搬运车|搬运机器人)/gi);
  remaining = removeMatched(remaining, /(\d+|[一二两三四五六七八九十]+)\s*台?\s*托盘\s*(?:agv|搬运车|搬运机器人)/gi);

  const pickSt = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*个?\s*(?:拣选台|拣选工位)/gi);
  remaining = removeMatched(remaining, /(\d+|[一二两三四五六七八九十]+)\s*个?\s*(?:拣选台|拣选工位)/gi);

  const packSt = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*个?\s*(?:打包台|打包工位)/gi);
  remaining = removeMatched(remaining, /(\d+|[一二两三四五六七八九十]+)\s*个?\s*(?:打包台|打包工位)/gi);

  const sortSt = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*个?\s*(?:分拣台|分拣工位)/gi);
  remaining = removeMatched(remaining, /(\d+|[一二两三四五六七八九十]+)\s*个?\s*(?:分拣台|分拣工位)/gi);

  // 2. General types — parse from remaining text only
  const genAGV = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*台?\s*(?:agv|搬运车|搬运机器人|机器人)/gi) - toteAGV - palletAGV;

  const genSt = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*个?\s*(?:工位|station)/gi) - pickSt - packSt - sortSt;

  // 3. Devices without subtypes
  const shelves = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*(?:组|排|个|列)?\s*(?:货架|shelf|高位存储)/gi) || 4;
  const arms = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*台?\s*(?:机械臂|arm)/gi);
  const chargers = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*(?:台|个)?\s*(?:充电桩|charger|充电)/gi) || 1;
  const conveyors = countExact(remaining, /(\d+|[一二两三四五六七八九十]+)\s*条?\s*(?:传送带|conveyor)/gi);

  // 4. General AGV allocation — ensure sum matches what user said
  const genAGVClamped = Math.max(0, genAGV);
  const totalAGV = toteAGV + palletAGV + genAGVClamped;
  const allocatedTote = toteAGV > 0 || palletAGV > 0
    ? toteAGV
    : (totalAGV > 0 ? Math.floor(totalAGV * 0.7) : (/(?:agv|搬运|机器人)/gi.test(orig) ? 2 : 2));
  const allocatedPallet = toteAGV > 0 || palletAGV > 0
    ? palletAGV
    : (totalAGV > 0 ? Math.ceil(totalAGV * 0.3) : 0);

  // 5. General station allocation — do NOT auto-fill unmentioned types
  const genStClamped = Math.max(0, genSt);
  const explicitStationTotal = pickSt + packSt + sortSt;
  let allocPick = pickSt, allocPack = packSt, allocSort = sortSt;

  if (explicitStationTotal > 0) {
    // User specified explicit types — keep them, don't add others from general
    if (genStClamped > 0) {
      allocPick += Math.ceil(genStClamped * 0.5);
      allocPack += Math.ceil(genStClamped * 0.3);
      allocSort += Math.floor(genStClamped * 0.2);
    }
  } else {
    // No explicit types at all — allocate from general OR default
    const totalSt = genStClamped > 0 ? genStClamped : (/(?:工位|station)/gi.test(orig) ? 1 : 1);
    allocPick = Math.ceil(totalSt * 0.5);
    allocPack = Math.ceil(totalSt * 0.3);
    allocSort = Math.floor(totalSt * 0.2);
  }

  return {
    shelves,
    agvs: { tote: allocatedTote, pallet: allocatedPallet },
    arms,
    conveyors,
    stations: { pick: allocPick, pack: allocPack, sort: allocSort },
    chargers,
  };
}

// ============================================================
// Layout engine with retry
// ============================================================

let idCtr = 0;
function nid(p: string) { idCtr++; return `${p}-${Date.now().toString(36)}-${idCtr}`; }

function mk(
  type: SceneComponent['type'], name: string,
  x: number, y: number, w: number, h: number,
  props: Record<string, string|number|boolean> = {},
): SceneComponent {
  return { id: nid(type), type, name, x: Math.round(x), y: Math.round(y), width: w, height: h, rotation: 0, properties: props };
}

function overlaps(a: Rect, b: Rect, gap = 8): boolean {
  return !(a.x + a.width + gap < b.x || b.x + a.width + gap < a.x ||
           a.y + a.height + gap < b.y || b.y + a.height + gap < a.y);
}

function findFreeSpot(
  placed: Rect[], w: number, h: number, W: number, H: number,
  startX: number, startY: number, stepX: number, stepY: number, maxCols: number,
): { x: number; y: number } | null {
  let col = 0, row = 0;
  const maxRows = Math.floor((H - startY - h) / stepY);
  while (row <= maxRows) {
    const cx = startX + col * stepX;
    const cy = startY + row * stepY;
    if (cx + w <= W - 20 && cy + h <= H - 20) {
      const r: Rect = { x: cx, y: cy, width: w, height: h };
      if (!placed.some((p) => overlaps(p, r))) return { x: cx, y: cy };
    }
    col++;
    if (col >= maxCols) { col = 0; row++; }
  }
  return null;
}

const MAX_RETRIES = 3;
const EXPAND_FACTOR = 1.3;

export function generateComponents(counts: DeviceCounts): {
  components: SceneComponent[];
  canvas: { width: number; height: number; scale: number };
  warnings: string[];
} {
  idCtr = 0;
  const totalRequested = counts.shelves
    + counts.agvs.tote + counts.agvs.pallet
    + counts.arms + counts.conveyors
    + counts.stations.pick + counts.stations.pack + counts.stations.sort
    + counts.chargers;

  const warnings: string[] = [];
  let components: SceneComponent[] = [];

  outer: for (let retry = 0; retry < MAX_RETRIES; retry++) {
    components = [];
    const scale = 1 + retry * (EXPAND_FACTOR - 1);
    let W = Math.round(Math.max(1200, totalRequested * 8) * scale);
    let H = Math.round(Math.max(800, totalRequested * 5) * scale);
    W = Math.min(W, 5000); H = Math.min(H, 4000);
    const placed: Rect[] = [];

    // Shelves
    for (let i = 0; i < counts.shelves; i++) {
      const w = 100, h = 40;
      const s = findFreeSpot(placed, w, h, W, H, 60, 60, 110, 52, Math.floor((W - 120) / 110));
      if (!s) { if (retry === MAX_RETRIES - 1) warnings.push(`货架仅放置 ${i}/${counts.shelves}`); else continue outer; break; }
      placed.push({ x: s.x, y: s.y, width: w, height: h });
      components.push(mk('shelf', `货架-${i + 1}`, s.x, s.y, w, h, { zone: String.fromCharCode(65 + Math.floor(i / 4)) }));
    }

    // Stations
    const stList: Array<{ key: string; label: string; count: number }> = [
      { key: 'pick', label: '拣选工位', count: counts.stations.pick },
      { key: 'pack', label: '打包工位', count: counts.stations.pack },
      { key: 'sort', label: '分拣工位', count: counts.stations.sort },
    ];
    for (const st of stList) {
      for (let j = 0; j < st.count; j++) {
        const w = 80, h = 60;
        const s = findFreeSpot(placed, w, h, W, H, W - 260, 60, 100, 80, 2);
        if (!s) { if (retry === MAX_RETRIES - 1) warnings.push(`${st.label}仅放置 ${j}/${st.count}`); else continue outer; break; }
        placed.push({ x: s.x, y: s.y, width: w, height: h });
        components.push(mk('station', `${st.label}-${j + 1}`, s.x, s.y, w, h, { station_type: st.key }));
      }
    }

    // Arms
    for (let i = 0; i < counts.arms; i++) {
      const w = 60, h = 60;
      const s = findFreeSpot(placed, w, h, W, H, W - 340, 60, 70, 80, 3);
      if (!s) { if (retry === MAX_RETRIES - 1) warnings.push(`机械臂仅放置 ${i}/${counts.arms}`); else continue outer; break; }
      placed.push({ x: s.x, y: s.y, width: w, height: h });
      components.push(mk('arm', `机械臂-${i + 1}`, s.x, s.y, w, h, { reach: 150, payload: 5 }));
    }

    // Conveyors
    for (let i = 0; i < counts.conveyors; i++) {
      const w = 100, h = 30;
      const s = findFreeSpot(placed, w, h, W, H, Math.floor(W * 0.4), 60, 110, 50, 3);
      if (!s) { if (retry === MAX_RETRIES - 1) warnings.push(`传送带仅放置 ${i}/${counts.conveyors}`); else continue outer; break; }
      placed.push({ x: s.x, y: s.y, width: w, height: h });
      components.push(mk('conveyor', `传送带-${i + 1}`, s.x, s.y, w, h, { speed: 1.5 }));
    }

    // Chargers
    for (let i = 0; i < counts.chargers; i++) {
      const w = 40, h = 40;
      const s = findFreeSpot(placed, w, h, W, H, 60, H - 150, 50, 50, Math.floor((W - 120) / 50));
      if (!s) { if (retry === MAX_RETRIES - 1) warnings.push(`充电桩仅放置 ${i}/${counts.chargers}`); else continue outer; break; }
      placed.push({ x: s.x, y: s.y, width: w, height: h });
      components.push(mk('charger', `充电桩-${i + 1}`, s.x, s.y, w, h, { power: 500 }));
    }

    // AGVs — bottom area with dynamic rows
    const agvTotal = counts.agvs.tote + counts.agvs.pallet;
    let agvSeq = 1;
    for (const [typeKey, typeCount] of [['tote', counts.agvs.tote] as const, ['pallet', counts.agvs.pallet] as const]) {
      for (let i = 0; i < typeCount; i++) {
        const w = 50, h = 50;
        const s = findFreeSpot(placed, w, h, W, H, 300, H - 200, 70, 70, Math.floor((W - 320) / 70));
        if (!s) { if (retry === MAX_RETRIES - 1) warnings.push(`AGV仅放置 ${agvSeq - 1}/${agvTotal}`); else continue outer; break; }
        placed.push({ x: s.x, y: s.y, width: w, height: h });
        components.push(mk('agv', `AGV-${String(agvSeq++).padStart(2, '0')}`, s.x, s.y, w, h,
          { battery: 85, max_speed: 2.0, agv_type: typeKey }));
      }
    }
    break; // success — exit retry loop
  }

  const finalW = Math.max(1200, components.length > 0 ? Math.max(...components.map((c) => c.x + c.width)) + 80 : 1200);
  const finalH = Math.max(800, components.length > 0 ? Math.max(...components.map((c) => c.y + c.height)) + 80 : 800);

  return { components, canvas: { width: finalW, height: finalH, scale: 1 }, warnings };
}

export function generateComponentsFromRequirement(requirement: string): {
  components: SceneComponent[];
  canvas: { width: number; height: number; scale: number };
  warnings: string[];
} {
  return generateComponents(parseRequirementForDevices(requirement));
}

// ============================================================
// Industry examples
// ============================================================

export const INDUSTRY_EXAMPLES: IndustryExample[] = [
  { key: 'ecom', name: '电商仓储', description: '高频拣选、多订单并发', requirement: '5台料箱AGV，8组货架，2个拣选工位，1个打包工位，2台充电桩', cover: 'ecom',
    counts: { shelves: 8, agvs: { tote: 5, pallet: 0 }, arms: 0, conveyors: 1, stations: { pick: 2, pack: 1, sort: 0 }, chargers: 2 } },
  { key: 'coldchain', name: '冷链物流', description: '多温区分离', requirement: '4台AGV（3台料箱+1台托盘），6组货架，1个拣选工位，1台机械臂，2台充电桩', cover: 'coldchain',
    counts: { shelves: 6, agvs: { tote: 3, pallet: 1 }, arms: 1, conveyors: 0, stations: { pick: 1, pack: 0, sort: 0 }, chargers: 2 } },
  { key: '3c', name: '3C电子', description: '日均8000单高峰', requirement: '8台AGV（6台料箱+2台托盘），10组货架，2个拣选工位，1个分拣工位，1台机械臂，3台充电桩', cover: '3c',
    counts: { shelves: 10, agvs: { tote: 6, pallet: 2 }, arms: 1, conveyors: 1, stations: { pick: 2, pack: 0, sort: 1 }, chargers: 3 } },
  { key: 'medical', name: '医药仓储', description: '严格温控、追溯管理', requirement: '3台料箱AGV，5组货架，1个拣选工位，1台机械臂，1台充电桩', cover: 'medical',
    counts: { shelves: 5, agvs: { tote: 3, pallet: 0 }, arms: 1, conveyors: 0, stations: { pick: 1, pack: 0, sort: 0 }, chargers: 1 } },
];
