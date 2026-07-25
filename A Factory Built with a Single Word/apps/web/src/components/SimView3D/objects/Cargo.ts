import * as THREE from 'three';
import type { WarehouseTransform } from '../WarehouseTransform';

/**
 * Creates a 3D cargo representation:
 * - Tote: blue box on top of AGV platform
 * - Carton: brown box
 * - Pallet: wooden pallet with stacked boxes
 */
export function createCargo(type: 'tote' | 'carton' | 'pallet', loaded = false): THREE.Group {
  const group = new THREE.Group();

  if (type === 'tote') {
    // Blue plastic tote box
    const tote = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.2, 0.28),
      new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.5, metalness: 0.2 }),
    );
    tote.position.y = 0.3;
    tote.castShadow = true;
    group.add(tote);

    // Tote lid rim
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(0.37, 0.02, 0.3),
      new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.4 }),
    );
    rim.position.y = 0.41;
    group.add(rim);
  } else if (type === 'carton') {
    // Brown cardboard box
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.25, 0.25),
      new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.8 }),
    );
    box.position.y = 0.32;
    box.castShadow = true;
    group.add(box);

    // Tape line
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.31, 0.01, 0.02),
      new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.6 }),
    );
    tape.position.set(0, 0.44, 0);
    group.add(tape);
  } else if (type === 'pallet') {
    // Wooden pallet base
    const palletBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.04, 0.4),
      new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.9 }),
    );
    palletBase.position.y = 0.08;
    palletBase.castShadow = true;
    group.add(palletBase);

    // Pallet blocks
    for (const [px, pz] of [[-0.18, -0.15], [0, -0.15], [0.18, -0.15], [-0.18, 0.15], [0, 0.15], [0.18, 0.15]]) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.04, 0.06),
        new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 }),
      );
      block.position.set(px, 0.02, pz);
      group.add(block);
    }

    // Boxes on pallet
    for (let i = 0; i < 3; i++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.15, 0.14),
        new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.8 }),
      );
      box.position.set(-0.07 + i * 0.07, 0.18, 0);
      box.castShadow = true;
      group.add(box);
    }
  }

  group.visible = loaded;
  group.name = 'cargo';
  return group;
}

/** Creates a 3D cargo object at a shelf/station position */
export function createStationCargo(type: 'tote' | 'carton' | 'pallet', transform: WarehouseTransform, x: number, y: number): THREE.Group {
  const group = createCargo(type, true);
  const pos = transform.point(x, y, 0.15);
  group.position.set(pos.x, 0.15, pos.z);
  return group;
}
