import * as THREE from 'three';
import type { WarehouseTransform } from '../WarehouseTransform';

/**
 * 虚线路径
 */
export function createPathLine(
  points: Array<[number, number]>,
  color: string,
  transform: WarehouseTransform,
): THREE.Line {
  const pts = points.map((p) => transform.point(p[0], p[1], 0.035));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(
    geo,
    new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06, linewidth: 1 }),
  );
  line.computeLineDistances();
  return line;
}
