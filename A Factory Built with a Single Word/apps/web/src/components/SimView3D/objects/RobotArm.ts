import * as THREE from 'three';

/**
 * 6 轴工业机械臂 — 正确关节层级：
 * root → base → J1 → J2(upperAssembly) → lowerAssembly → endEffector(J6)
 */
export function createRobotArm(): THREE.Group {
  const root = new THREE.Group();

  const metalMat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.85 });
  const jointMat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, metalness: 0.95 });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.4, metalness: 0.3 });
  const hoseMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.7, metalness: 0.1 });

  // ===== 固定底座 ====
  const base = new THREE.Group();

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.05, 24),
    metalMat('#334155'),
  );
  plate.castShadow = true; plate.receiveShadow = true;
  base.add(plate);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.03, 8),
      accentMat,
    );
    bolt.position.set(Math.cos(a) * 0.18, 0.015, Math.sin(a) * 0.18);
    base.add(bolt);
  }
  root.add(base);

  // ===== J1 旋转底座 (child of root) ====
  const j1 = new THREE.Group();
  j1.name = 'arm-J1';
  j1.position.y = 0.055;

  const j1Body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 0.12, 24),
    metalMat('#a855f7'),
  );
  j1Body.castShadow = true;
  j1.add(j1Body);

  const j1Ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.02, 8, 24),
    jointMat('#c084fc'),
  );
  j1Ring.rotation.x = Math.PI / 2;
  j1Ring.position.y = -0.05;
  j1.add(j1Ring);

  root.add(j1);

  // ===== J2 上臂 (child of J1) ====
  const j2 = new THREE.Group();
  j2.name = 'arm-J2';
  j2.position.set(0, 0.06, 0);

  // J2 shoulder sphere
  const j2Sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    jointMat('#7e22ce'),
  );
  j2.add(j2Sphere);
  const j2Ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.012, 8, 16),
    jointMat('#a78bfa'),
  );
  j2Ring.rotation.x = Math.PI / 2;
  j2.add(j2Ring);

  // upper arm (extends from J2)
  const upperArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 0.35, 12),
    metalMat('#a855f7'),
  );
  upperArm.position.set(0.04, 0.18, 0);
  upperArm.rotation.z = -Math.PI / 3;
  upperArm.castShadow = true;
  j2.add(upperArm);

  // hydraulic hose
  const hose1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6),
    hoseMat,
  );
  hose1.position.set(-0.02, 0.16, 0.06);
  hose1.rotation.z = -Math.PI / 3 + 0.1;
  j2.add(hose1);

  // J3 at the end of upper arm
  const j3 = new THREE.Group();
  j3.name = 'arm-J3';
  j3.position.set(0.13, 0.33, 0);

  const j3Sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 8),
    jointMat('#7e22ce'),
  );
  j3.add(j3Sphere);
  const j3Ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.01, 8, 12),
    jointMat('#a78bfa'),
  );
  j3Ring.rotation.x = Math.PI / 2;
  j3.add(j3Ring);

  j2.add(j3);

  j1.add(j2);

  // ===== 前臂 (child of J3) ====
  const forearm = new THREE.Group();
  forearm.name = 'arm-J4';

  const lowerArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, 0.22, 10),
    metalMat('#a855f7'),
  );
  lowerArm.position.set(0.05, 0.1, 0);
  lowerArm.rotation.z = Math.PI / 6;
  lowerArm.castShadow = true;
  forearm.add(lowerArm);

  // J5 at end of forearm
  const j5 = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 8),
    jointMat('#7e22ce'),
  );
  j5.position.set(0.12, 0.2, 0);
  forearm.add(j5);

  const hose2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6),
    hoseMat,
  );
  hose2.position.set(0.02, 0.12, 0.05);
  hose2.rotation.z = Math.PI / 6 + 0.15;
  forearm.add(hose2);

  j3.add(forearm);

  // ===== J6 末端执行器 (child of forearm) ====
  const endEffector = new THREE.Group();
  endEffector.name = 'arm-J6';
  endEffector.position.set(0.12, 0.2, 0);

  const wrist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.06, 10),
    metalMat('#475569'),
  );
  endEffector.add(wrist);

  const gripperBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.03, 0.05),
    metalMat('#334155'),
  );
  gripperBase.position.y = -0.04;
  endEffector.add(gripperBase);

  for (const x of [-0.025, 0.025]) {
    const finger = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.08, 0.04),
      metalMat('#64748b'),
    );
    finger.position.set(x, -0.08, 0);
    endEffector.add(finger);

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.017, 0.01, 0.01),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 }),
    );
    pad.position.set(x, -0.12, 0);
    endEffector.add(pad);
  }

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8),
    accentMat,
  );
  beam.rotation.x = Math.PI / 2;
  beam.position.y = -0.055;
  endEffector.add(beam);

  j3.add(endEffector);

  // ===== 地面投影 =====
  const floorShadow = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.16, 16),
    new THREE.MeshBasicMaterial({ color: '#a855f7', transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
  );
  floorShadow.rotation.x = -Math.PI / 2;
  floorShadow.position.y = 0.005;
  root.add(floorShadow);

  root.userData = { isRobotArm: true };
  root.castShadow = true;
  return root;
}
