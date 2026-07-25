import * as THREE from 'three';
import type { AgvState } from '../types';
import { AGV_STATE_COLORS, AGV_STATE_GLOW } from '../types';

// ============================================================
// Real-world inspired AGV designs
// ============================================================

/**
 * Tote AMR — inspired by real Kiva/Amazon Robotics style AGVs
 * Features: sleek white body, orange accent stripe, omnni wheels,
 * top-mounted tote platform, front LED strip, status ring
 */
export function createToteAMR(color: string, state: AgvState = 'idle'): THREE.Group {
  const root = new THREE.Group();
  root.castShadow = true;

  const darkMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.5,
    metalness: 0.3,
  });
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: '#f97316',
    roughness: 0.3,
    metalness: 0.4,
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.6 });

  // Main body — rounded rectangle shape (white base)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.38), bodyMat);
  body.position.y = 0.07;
  body.castShadow = true;
  root.add(body);

  // Orange accent stripe around mid-body
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.015, 0.39), accentMat);
  stripe.position.y = 0.07;
  root.add(stripe);

  // Top platform (where tote sits)
  const platform = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.33), darkMat);
  platform.position.y = 0.125;
  platform.castShadow = true;
  root.add(platform);

  // Rubber bumper edge
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.02, 0.39), darkMat);
  bumper.position.y = 0.02;
  root.add(bumper);

  // 4 mecanum wheels (visible on sides)
  for (const [wx, wz] of [
    [-0.22, -0.15],
    [0.22, -0.15],
    [-0.22, 0.15],
    [0.22, 0.15],
  ]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.035, wz);
    wheel.name = 'agv-wheel';
    root.add(wheel);
  }

  // Front LED strip (blue when moving, green when ready)
  const frontLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.008, 0.005),
    new THREE.MeshStandardMaterial({
      color: '#3b82f6',
      emissive: '#3b82f6',
      emissiveIntensity: 1.0,
    }),
  );
  frontLed.position.set(0, 0.1, 0.195);
  frontLed.name = 'status-led';
  root.add(frontLed);

  // Status ring on top
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.01, 8, 20),
    new THREE.MeshStandardMaterial({
      color: AGV_STATE_GLOW[state] || '#22c55e',
      emissive: AGV_STATE_GLOW[state] || '#22c55e',
      emissiveIntensity: 0.8,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.16;
  ring.name = 'status-ring';
  root.add(ring);

  // Floor projection glow
  const floorGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.09, 16),
    new THREE.MeshBasicMaterial({
      color: AGV_STATE_GLOW[state] || '#22c55e',
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    }),
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = 0.005;
  floorGlow.name = 'floor-glow';
  root.add(floorGlow);

  // Lidar sensor on top
  const lidar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.015, 12),
    new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.9, roughness: 0.2 }),
  );
  lidar.position.set(0, 0.145, 0);
  lidar.name = 'lidar';
  root.add(lidar);

  root.userData = { isAGV: true, state, agvType: 'tote_amr' };
  return root;
}

/**
 * Pallet AMR — inspired by real forklift-style AGVs
 * Features: yellow/gray color scheme, front forks, higher clearance,
 * wider body, robust construction
 */
export function createPalletAMR(color: string, state: AgvState = 'idle'): THREE.Group {
  const root = new THREE.Group();
  root.castShadow = true;

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.6 });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: '#eab308',
    roughness: 0.3,
    metalness: 0.4,
  });
  const forkMat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    roughness: 0.4,
    metalness: 0.7,
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.6 });

  // Wider, taller body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.5), bodyMat);
  body.position.y = 0.08;
  body.castShadow = true;
  root.add(body);

  // Yellow safety stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.012, 0.51), yellowMat);
  stripe.position.y = 0.08;
  root.add(stripe);

  // Fork carriage assembly
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.48), forkMat);
  carriage.position.set(0.35, 0.1, 0);
  root.add(carriage);

  // Left fork tine
  const tineL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.04), forkMat);
  tineL.position.set(0.1, 0.04, -0.18);
  tineL.castShadow = true;
  root.add(tineL);

  // Right fork tine
  const tineR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.04), forkMat);
  tineR.position.set(0.1, 0.04, 0.18);
  tineR.castShadow = true;
  root.add(tineR);

  // Heavy-duty wheels
  for (const [wx, wz] of [
    [-0.28, -0.2],
    [0.28, -0.2],
    [-0.28, 0.2],
    [0.28, 0.2],
  ]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.045, wz);
    wheel.name = 'agv-wheel';
    root.add(wheel);
  }

  // Status LED strip
  const frontLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.01, 0.006),
    new THREE.MeshStandardMaterial({
      color: '#3b82f6',
      emissive: '#3b82f6',
      emissiveIntensity: 1.0,
    }),
  );
  frontLed.position.set(0, 0.14, 0.255);
  frontLed.name = 'status-led';
  root.add(frontLed);

  // Status ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.012, 8, 20),
    new THREE.MeshStandardMaterial({
      color: AGV_STATE_GLOW[state] || '#22c55e',
      emissive: AGV_STATE_GLOW[state] || '#22c55e',
      emissiveIntensity: 0.8,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.18;
  ring.name = 'status-ring';
  root.add(ring);

  // Floor glow
  const floorGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.1, 16),
    new THREE.MeshBasicMaterial({
      color: AGV_STATE_GLOW[state] || '#22c55e',
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    }),
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = 0.005;
  floorGlow.name = 'floor-glow';
  root.add(floorGlow);

  root.userData = { isAGV: true, state, agvType: 'pallet_amr' };
  return root;
}

/** Factory function to create the correct AGV type */
export function createAGVByType(
  color: string,
  state: AgvState,
  type?: 'tote_amr' | 'pallet_amr',
): THREE.Group {
  if (type === 'pallet_amr') return createPalletAMR(color, state);
  return createToteAMR(color, state);
}

/** Backward-compatible alias */
export const createAGV = createAGVByType;

/** Set AGV state colors and effects */
export function setAGVState(agv: THREE.Group, state: AgvState, battery?: number): void {
  const ring = agv.getObjectByName('status-ring') as THREE.Mesh | undefined;
  if (ring) {
    const mat = ring.material as THREE.MeshStandardMaterial;
    const glowColor = AGV_STATE_GLOW[state] || '#94a3b8';
    mat.color.set(glowColor);
    mat.emissive.set(glowColor);
    mat.emissiveIntensity = state.startsWith('waiting')
      ? 0.3 + Math.sin(Date.now() * 0.005) * 0.2
      : 0.8;
  }

  const floorGlow = agv.getObjectByName('floor-glow') as THREE.Mesh | undefined;
  if (floorGlow) {
    const fm = floorGlow.material as THREE.MeshBasicMaterial;
    fm.color.set(AGV_STATE_GLOW[state] || '#94a3b8');
    fm.opacity = state === 'idle' ? 0.06 : 0.12;
  }

  const glowColor = AGV_STATE_COLORS[state] || '#94a3b8';
  agv.children.forEach((child) => {
    if (child.name !== 'status-led' || !(child instanceof THREE.Mesh)) return;
    const material = child.material as THREE.MeshStandardMaterial;
    material.color.set(glowColor);
    material.emissive.set(glowColor);
    material.emissiveIntensity = state === 'idle' ? 0.3 : 1.0;
  });

  if (state === 'fault') {
    agv.userData.faultFlash = true;
  } else {
    agv.userData.faultFlash = false;
  }

  agv.userData.state = state;
  if (battery !== undefined) setAGVBattery(agv, battery);
}

/** Fault flash animation */
export function updateFaultFlash(agv: THREE.Group, time: number): void {
  if (!agv.userData.faultFlash) return;
  agv.visible = Math.sin(time * 8) > 0;
}

/** Set AGV battery indicator */
export function setAGVBattery(agv: THREE.Group, battery: number): void {
  agv.userData.battery = battery;
  if (battery <= 15) {
    const ring = agv.getObjectByName('status-ring') as THREE.Mesh | undefined;
    if (ring) {
      (ring.material as THREE.MeshStandardMaterial).color.set('#ef4444');
      (ring.material as THREE.MeshStandardMaterial).emissive.set('#ef4444');
    }
  }
}
