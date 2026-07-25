import * as THREE from 'three';
import type { WarehouseTransform } from '../WarehouseTransform';

/**
 * 地面网格
 * @param w 宽度（world units）
 * @param h 深度（world units）
 * @returns 居中在 (w/2, 0, h/2) 的地面组
 */
export function createFloor(w: number, h: number): THREE.Group {
  const group = new THREE.Group();

  // 主地面 — 居中
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: '#09192b', roughness: 0.88, metalness: 0.12 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(w / 2, -0.01, h / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // 网格线 — 居中
  // GridHelper is always square. Build the lines ourselves so a rectangular
  // warehouse has a complete grid exactly inside its physical boundary.
  const spacing = 0.25;
  const vertices: number[] = [];
  for (let x = 0; x <= w + 0.001; x += spacing) {
    const value = Math.min(x, w);
    vertices.push(value, 0.004, 0, value, 0.004, h);
  }
  for (let z = 0; z <= h + 0.001; z += spacing) {
    const value = Math.min(z, h);
    vertices.push(0, 0.004, value, w, 0.004, value);
  }
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  group.add(new THREE.LineSegments(
    gridGeometry,
    new THREE.LineBasicMaterial({ color: '#1d5279', transparent: true, opacity: 0.46 }),
  ));

  // 边框 — 居中
  const border = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h));
  const edge = new THREE.LineSegments(
    border,
    new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.52 }),
  );
  edge.rotation.x = -Math.PI / 2;
  edge.position.set(w / 2, 0.01, h / 2);
  group.add(edge);

  return group;
}

/**
 * 矩形区域（货架区）
 */
export function createZone(
  opt: { x: number; y: number; w: number; h: number; color: string; label: string },
  transform: WarehouseTransform,
): THREE.Group {
  const group = new THREE.Group();
  const center = transform.point(opt.x + opt.w / 2, opt.y + opt.h / 2);
  const { width: w3, height: h3 } = transform.size(opt.w, opt.h);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w3, 0.02, h3),
    new THREE.MeshStandardMaterial({
      color: opt.color, emissive: opt.color, emissiveIntensity: 0.07,
      transparent: true, opacity: 0.14, roughness: 0.8,
    }),
  );
  base.position.set(center.x, 0, center.z);
  group.add(base);

  const bb = new THREE.EdgesGeometry(new THREE.BoxGeometry(w3, 0.02, h3));
  const bl = new THREE.LineSegments(bb, new THREE.LineBasicMaterial({ color: opt.color, transparent: true, opacity: 0.62 }));
  bl.position.set(center.x, 0.02, center.z);
  group.add(bl);

  return group;
}
