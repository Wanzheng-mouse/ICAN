import * as THREE from 'three';
import type { WarehouseTransform } from '../WarehouseTransform';

/**
 * Creates a realistic high-bay shelf unit with multiple levels and slots.
 * Matches the warehouseFactory shelf zone layout.
 */
export function createShelf(
  x: number, y: number, w: number, h: number,
  color: string, transform: WarehouseTransform,
  levels: number = 4,
): THREE.Group {
  const group = new THREE.Group();
  const center = transform.point(x + w / 2, y + h / 2);
  const { width: w3, height: h3 } = transform.size(w, h);

  const rackHeight = 1.45;
  const uprightMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.38, metalness: 0.72 });
  const beamMat = new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.58 });
  const deckMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.48, metalness: 0.68 });
  // Muted industrial packaging colors keep shelves readable without turning
  // every occupied cell into a neon stripe in the overview camera.
  const cargoColors = ['#a87846', '#496985', '#527562', '#755e79'];

  // Open pallet-rack construction: visible uprights and beams rather than
  // opaque white slabs. This keeps the high-bay storage readable at overview
  // scale and makes every bay look physically accessible from an aisle.
  const bayCount = Math.max(3, Math.round(w / 58));
  const bayWidth = w3 / bayCount;
  for (let bay = 0; bay <= bayCount; bay += 1) {
    const x = center.x - w3 / 2 + bay * bayWidth;
    for (const zOffset of [-h3 / 2, h3 / 2]) {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.04, rackHeight, 0.04), uprightMat);
      upright.position.set(x, rackHeight / 2, center.z + zOffset);
      upright.castShadow = true;
      group.add(upright);
    }
  }

  for (let level = 0; level < levels; level += 1) {
    const levelY = 0.12 + level * (rackHeight - 0.16) / levels;
    for (const zOffset of [-h3 / 2, h3 / 2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w3, 0.055, 0.045), beamMat);
      rail.position.set(center.x, levelY, center.z + zOffset);
      rail.castShadow = true;
      group.add(rail);
    }
    for (let bay = 0; bay < bayCount; bay += 1) {
      const x = center.x - w3 / 2 + (bay + 0.5) * bayWidth;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(bayWidth * 0.78, 0.018, h3 * 0.78), deckMat);
      deck.position.set(x, levelY - 0.012, center.z);
      deck.receiveShadow = true;
      group.add(deck);
    }

    // Deterministic partial occupancy gives depth without visual noise.
    for (let bay = 0; bay < bayCount; bay += 1) {
      if ((bay + level * 2) % 3 !== 0) continue;
      const cargo = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.1, bayWidth * 0.64), 0.16, Math.max(0.1, h3 * 0.56)),
        new THREE.MeshStandardMaterial({
          color: cargoColors[(bay + level) % cargoColors.length], roughness: 0.82, metalness: 0.01,
        }),
      );
      cargo.position.set(center.x - w3 / 2 + (bay + 0.5) * bayWidth, levelY + 0.095, center.z);
      cargo.castShadow = true;
      group.add(cargo);
    }
  }

  group.userData.kind = 'warehouse-rack';

  return group;
}

/**
 * Creates a stacker crane for high-bay storage.
 * Features: vertical rail, horizontal beam, lifting mechanism, fork.
 */
export function createStackerCrane(
  x: number, y: number, transform: WarehouseTransform,
  color: string = '#eab308',
): THREE.Group {
  const group = new THREE.Group();
  const pos = transform.point(x, y);
  const cx = pos.x;
  const cz = pos.z;

  const railMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.4, metalness: 0.8 });
  const craneMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.4 });

  // Vertical rail (runs along aisle)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.5, 0.03), railMat);
  rail.position.set(cx, 1.25, cz);
  rail.castShadow = true;
  group.add(rail);

  // Base plate
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.2), darkMat);
  base.position.set(cx, 0.015, cz);
  base.castShadow = true;
  group.add(base);

  // Cross beam (horizontal)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.6), railMat);
  beam.position.set(cx, 0.3, cz);
  group.add(beam);

  // Lifting carriage
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), craneMat);
  carriage.position.set(cx, 0.5, cz);
  carriage.castShadow = true;
  carriage.name = 'crane-carriage';
  group.add(carriage);

  // Fork mechanism
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.02), darkMat);
  fork.position.set(cx + 0.15, 0.5, cz);
  group.add(fork);

  // Status LED
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 0.5 }),
  );
  led.position.set(cx, 2.5, cz);
  group.add(led);

  return group;
}

/**
 * Creates a conveyor belt section.
 */
export function createConveyor(
  x: number, y: number, length: number, transform: WarehouseTransform,
  color: string = '#64748b',
): THREE.Group {
  const group = new THREE.Group();
  const center = transform.point(x, y);
  const { width: w3 } = transform.size(length, 0);

  const frameMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.4 });
  const beltMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 });

  // Support legs
  for (const xOff of [-length / 3, 0, length / 3]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.3), frameMat);
    const p = transform.point(x + xOff, y);
    leg.position.set(p.x, 0.15, p.z);
    group.add(leg);
  }

  // Belt surface
  const belt = new THREE.Mesh(new THREE.BoxGeometry(w3, 0.02, 0.35), beltMat);
  belt.position.set(center.x, 0.32, center.z);
  group.add(belt);

  // Side rails
  for (const zOff of [-0.18, 0.18]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w3, 0.04, 0.02), frameMat);
    rail.position.set(center.x, 0.35, center.z + zOff);
    group.add(rail);
  }

  return group;
}

/**
 * Creates a charger station.
 */
export function createCharger(
  x: number, y: number, transform: WarehouseTransform,
  color: string = '#10b981',
): THREE.Group {
  const group = new THREE.Group();
  const pos = transform.point(x, y);

  // Base platform
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 0.04, 12),
    new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 }),
  );
  base.position.set(pos.x, 0.02, pos.z);
  group.add(base);

  // Post
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4, metalness: 0.7 }),
  );
  post.position.set(pos.x, 0.29, pos.z);
  post.castShadow = true;
  group.add(post);

  // Charging panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.25, 0.02),
    new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 }),
  );
  panel.position.set(pos.x, 0.4, pos.z + 0.05);
  group.add(panel);

  // Status light
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }),
  );
  light.position.set(pos.x, 0.56, pos.z);
  group.add(light);

  return group;
}
