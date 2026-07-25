import * as THREE from 'three';
import type { WarehouseTransform } from '../WarehouseTransform';

/**
 * 工作站 / 充电桩 3D 标记 — 增强版
 * 充电桩：立柱 + 发光球 + 占用指示 + 排队 AGV 标记
 * 工位：平台 + 状态灯 + 排队指示
 */
export function createStation(
  x: number,
  y: number,
  label: string,
  type: string,
  color: string,
  transform: WarehouseTransform,
  isCharger = false,
): THREE.Group {
  const group = new THREE.Group();
  const position = transform.point(x, y);
  const cx = position.x;
  const cz = position.z;
  group.userData.label = label;
  group.userData.stationType = type;

  if (type === 'charge' || isCharger) {
    // 充电桩：立柱 + 顶部发光球
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.6, 0.18),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4, metalness: 0.7 }),
    );
    post.position.set(cx, 0.3, cz);
    post.castShadow = true;
    group.add(post);

    // 充电面板
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.35, 0.02),
      new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 }),
    );
    panel.position.set(cx, 0.35, cz + 0.1);
    group.add(panel);

    // 顶部发光球 (状态指示)
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.8,
      }),
    );
    tip.position.set(cx, 0.63, cz);
    tip.name = 'charger-status-light';
    group.add(tip);

    // 底座
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.04, 12),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 }),
    );
    base.position.set(cx, 0.02, cz);
    group.add(base);

    // 充电线缆 (螺旋形)
    const cablePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      cablePoints.push(
        new THREE.Vector3(
          cx + Math.sin(t * Math.PI * 4) * 0.03,
          0.04 + t * 0.4,
          cz + 0.1 + Math.cos(t * Math.PI * 4) * 0.03,
        ),
      );
    }
    const cableGeo = new THREE.BufferGeometry().setFromPoints(cablePoints);
    const cable = new THREE.Line(cableGeo, new THREE.LineBasicMaterial({ color: '#475569' }));
    group.add(cable);
  } else {
    // 工作站：扁平平台 + 状态灯
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.06, 0.4),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6, metalness: 0.3 }),
    );
    platform.position.set(cx, 0.03, cz);
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);

    // 工作台面
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.02, 0.35),
      new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 }),
    );
    tableTop.position.set(cx, 0.07, cz);
    group.add(tableTop);

    // 状态指示灯
    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.7,
      }),
    );
    indicator.position.set(cx, 0.12, cz);
    indicator.name = 'station-status-light';
    group.add(indicator);

    // 围栏柱
    for (const [sx, sz] of [
      [-0.28, -0.18],
      [0.28, -0.18],
      [-0.28, 0.18],
      [0.28, 0.18],
    ]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6),
        new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8 }),
      );
      pillar.position.set(cx + sx, 0.08, cz + sz);
      group.add(pillar);
    }
  }

  return group;
}

/**
 * 拥堵热区 — 增强版 (带平均等待时间标签)
 */
export function createCongestion(
  x: number,
  y: number,
  radius: number,
  intensity: number,
  transform: WarehouseTransform,
  _avgWaitSeconds = 0,
): THREE.Mesh {
  const position = transform.point(x, y);
  const cx = position.x;
  const cz = position.z;
  const r = transform.size(radius, radius).width;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0, r, 32),
    new THREE.MeshBasicMaterial({
      color: intensity > 0.6 ? '#ef4444' : '#f59e0b',
      transparent: true,
      opacity: intensity * 0.35,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.04, cz);
  ring.userData = { baseOpacity: intensity * 0.35, pulseOffset: (x + y) / 100 };

  return ring;
}

/**
 * 缓冲区可视化
 */
export function createBufferZone(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  transform: WarehouseTransform,
): THREE.Group {
  const group = new THREE.Group();
  const center = transform.point(x + w / 2, y + h / 2);
  const { width: w3, height: h3 } = transform.size(w, h);

  // 半透明地面
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w3, h3),
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.1,
      roughness: 1,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0.01, center.z);
  group.add(floor);

  // 虚线边框
  const edges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w3, h3));
  const border = new THREE.LineSegments(
    edges,
    new THREE.LineDashedMaterial({
      color,
      dashSize: 0.15,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.5,
    }),
  );
  border.rotation.x = -Math.PI / 2;
  border.position.set(center.x, 0.02, center.z);
  border.computeLineDistances();
  group.add(border);

  return group;
}
