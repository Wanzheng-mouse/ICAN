import type { ComponentLibraryItem, OperationLog, SceneComponent, SceneOverviewStats } from '@ican/contracts';

export const editorComponentLibrary: ComponentLibraryItem[] = [
  { category: 'shelf', name: '标准货架（单面）', spec: '1200×600×2000mm', count: 24, iconColor: '#3b82f6' },
  { category: 'shelf', name: '标准货架（双面）', spec: '2400×600×2000mm', count: 36, iconColor: '#3b82f6' },
  { category: 'shelf', name: '重型货架', spec: '2400×1000×3000mm', count: 12, iconColor: '#1d4ed8' },
  { category: 'shelf', name: '窄巷道货架', spec: '1500×1000×4000mm', count: 8, iconColor: '#2563eb' },
  { category: 'shelf', name: '驶入式货架', spec: '3000×1200×4000mm', count: 6, iconColor: '#1e40af' },
  { category: 'shelf', name: '悬臂式货架', spec: '2000×800×2500mm', count: 4, iconColor: '#1e3a8a' },
  { category: 'agv', name: '潜伏式 AGV', spec: '800×600×300mm', count: 16, iconColor: '#06b6d4' },
  { category: 'agv', name: '叉车 AGV', spec: '1500×900×1800mm', count: 6, iconColor: '#0891b2' },
  { category: 'arm', name: '六轴机械臂', spec: '工作半径 1200mm', count: 4, iconColor: '#a855f7' },
  { category: 'arm', name: 'SCARA 机械臂', spec: '工作半径 600mm', count: 2, iconColor: '#9333ea' },
  { category: 'conveyor', name: '辊筒输送线', spec: '2000×600mm', count: 8, iconColor: '#22c55e' },
  { category: 'conveyor', name: '皮带输送线', spec: '2000×500mm', count: 6, iconColor: '#16a34a' },
  { category: 'station', name: '拣选工作站', spec: '1500×1200mm', count: 8, iconColor: '#f59e0b' },
  { category: 'station', name: '包装工作站', spec: '1500×1200mm', count: 4, iconColor: '#ea580c' },
  { category: 'charger', name: '标准充电桩', spec: '300×200×1200mm', count: 6, iconColor: '#10b981' },
  { category: 'charger', name: '快充充电桩', spec: '400×250×1500mm', count: 2, iconColor: '#059669' },
  { category: 'obstacle', name: '围墙/障碍物', spec: '自定义', count: 0, iconColor: '#64748b' },
];

export const editorSceneComponents: SceneComponent[] = [
  { id: 'shelf-A1', type: 'shelf', name: 'A 区货架 - 01', x: 200, y: 200, width: 240, height: 80, rotation: 0, properties: { zone: 'A', doubleSided: true, capacity: 200 } },
  { id: 'shelf-A2', type: 'shelf', name: 'A 区货架 - 02', x: 460, y: 200, width: 240, height: 80, rotation: 0, properties: { zone: 'A', doubleSided: true, capacity: 200 } },
  { id: 'shelf-A3', type: 'shelf', name: 'A 区货架 - 03', x: 200, y: 320, width: 240, height: 80, rotation: 0, properties: { zone: 'A', doubleSided: true, capacity: 200 } },
  { id: 'shelf-A4', type: 'shelf', name: 'A 区货架 - 04', x: 460, y: 320, width: 240, height: 80, rotation: 0, properties: { zone: 'A', doubleSided: true, capacity: 200 } },
  { id: 'shelf-B1', type: 'shelf', name: 'B 区货架 - 01', x: 760, y: 200, width: 240, height: 80, rotation: 0, properties: { zone: 'B', doubleSided: true, capacity: 200 } },
  { id: 'shelf-C1', type: 'shelf', name: 'C 区货架 - 01', x: 200, y: 460, width: 240, height: 80, rotation: 0, properties: { zone: 'C', doubleSided: true, capacity: 200 } },
  { id: 'shelf-D1', type: 'shelf', name: 'D 区货架 - 01', x: 760, y: 460, width: 240, height: 80, rotation: 0, properties: { zone: 'D', doubleSided: true, capacity: 200 } },
  { id: 'station-pick-1', type: 'station', name: '拣选工作站 - 01', x: 400, y: 130, width: 80, height: 50, rotation: 0, properties: { type: 'pick' } },
  { id: 'station-pack-1', type: 'station', name: '包装工作站 - 01', x: 600, y: 130, width: 80, height: 50, rotation: 0, properties: { type: 'pack' } },
  { id: 'arm-1', type: 'arm', name: '机械臂 - 01', x: 530, y: 280, width: 40, height: 40, rotation: 0, properties: {} },
  { id: 'charger-1', type: 'charger', name: '充电桩 - 01', x: 480, y: 580, width: 30, height: 30, rotation: 0, properties: {} },
  { id: 'charger-2', type: 'charger', name: '充电桩 - 02', x: 540, y: 580, width: 30, height: 30, rotation: 0, properties: {} },
  { id: 'agv-1', type: 'agv', name: 'AGV-001', x: 380, y: 400, width: 24, height: 16, rotation: 0, properties: { battery: 85 } },
  { id: 'agv-2', type: 'agv', name: 'AGV-002', x: 620, y: 400, width: 24, height: 16, rotation: 0, properties: { battery: 62 } },
];

export const editorSelectedComponent: SceneComponent = {
  id: 'shelf-A1',
  type: 'shelf',
  name: '标准货架（双面）- 01',
  x: 200,
  y: 200,
  width: 240,
  height: 80,
  rotation: 0,
  properties: { capacity: 200, doubleSided: true },
};

export const editorSelectedProperty = {
  id: 'shelf_00123',
  name: '标准货架（双面）- 01',
  type: '标准货架（双面）',
  x: 24.6,
  y: 18.4,
  width: 2.4,
  height: 0.6,
  depth: 2.0,
  rotation: 0,
  capacity: 200,
  capacityPerLayer: 5,
  layers: 5,
  safetyDistance: 0.8,
  walkable: true,
  participateInSimulation: true,
};

export const editorSceneRules = {
  direction: '双向通行',
  speedLimit: 1.2,
  forbiddenZones: 2,
  safetyBoundary: '已启用',
};

export const editorOverview: SceneOverviewStats = {
  shelves: 86,
  agvs: 18,
  arms: 6,
  stations: 12,
  totalArea: 6240,
  passableRate: 68.5,
  shelvesArea: 1124,
  agvOnlines: 16,
  agvOffline: 2,
  stationTypes: '拣选 8 | 包装 4',
  canvasSize: '96m × 65m',
  passableArea: 4277,
};

export const editorOperationLogs: OperationLog[] = [
  { time: '14:35', user: '张三', action: '移动', target: '标准货架（双面）- 01', details: '位移 1.2m, 0.8m' },
  { time: '14:32', user: '张三', action: '添加', target: 'AGV-18' },
  { time: '14:28', user: '李四', action: '删除', target: '传送带-03' },
  { time: '14:26', user: '张三', action: '修改', target: '速度限制', details: '1.2 m/s' },
  { time: '14:20', user: '系统', action: '自动生成布局' },
];

export const editorTools = [
  { key: 'select', label: '选择', icon: 'SelectOutlined' },
  { key: 'move', label: '移动', icon: 'DragOutlined' },
  { key: 'rotate', label: '旋转', icon: 'ReloadOutlined' },
  { key: 'delete', label: '删除', icon: 'DeleteOutlined' },
  { key: 'align', label: '对齐', icon: 'AlignCenterOutlined' },
  { key: 'annotate', label: '标注', icon: 'TagsOutlined' },
  { key: 'measure', label: '测量', icon: 'ColumnHeightOutlined' },
];
