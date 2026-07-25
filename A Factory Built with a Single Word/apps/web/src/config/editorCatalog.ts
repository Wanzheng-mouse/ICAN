import type { ComponentLibraryItem } from '@ican/contracts';

/** Built-in equipment catalog; configuration metadata rather than runtime sample data. */
export const editorComponentLibrary: ComponentLibraryItem[] = [
  { category: 'shelf', name: '标准货架（单面）', spec: '1200×600×2000mm', count: 24, iconColor: '#3b82f6' },
  { category: 'shelf', name: '标准货架（双面）', spec: '2400×600×2000mm', count: 36, iconColor: '#3b82f6' },
  { category: 'shelf', name: '重型货架', spec: '2400×1000×3000mm', count: 12, iconColor: '#1d4ed8' },
  { category: 'shelf', name: '窄巷道货架', spec: '1500×1000×4000mm', count: 8, iconColor: '#2563eb' },
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
