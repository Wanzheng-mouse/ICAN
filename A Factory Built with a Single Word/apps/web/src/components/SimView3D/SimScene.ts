import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import gsap from 'gsap';
import { createFloor, createZone } from './objects/Floor';
import { createPathLine } from './objects/PathLine';
import { createShelf } from './objects/Shelf';
import { createAGVByType, setAGVState, updateFaultFlash } from './objects/AGV';
import { createStation, createCongestion, createBufferZone } from './objects/Station';
import { createRobotArm } from './objects/RobotArm';
import { createCargo } from './objects/Cargo';
import { ArmAnimator } from './animation/ArmAnimator';
import { WarehouseTransform } from './WarehouseTransform';
import type { SimView3DProps } from './types';
import type { AgvState } from './types';
import { AGV_STATE_COLORS, AGV_STATE_GLOW } from './types';
import type { WallSegment, Door } from './digitalTwin';
import { WallType, DoorType } from './digitalTwin';

const WORLD_W = 14;
const WORLD_H = 10;
const CAMERA_TARGET = new THREE.Vector3(WORLD_W / 2, 0, WORLD_H / 2);
const CAMERA_HOME = new THREE.Vector3(WORLD_W / 2, 14, WORLD_H / 2 + 4.8);
const VIEW_PADDING = 1.1;

function viewHeightFor(aspect: number): number {
  return Math.max(WORLD_H + VIEW_PADDING * 2, (WORLD_W + VIEW_PADDING * 2) / aspect);
}

interface RouteEntry {
  line: THREE.Line;
  signature: string;
}

interface ArmEntry {
  animator: ArmAnimator;
  state: 'idle' | 'working';
}

/**
 * Enhanced Three.js rendering scene for the Digital Twin warehouse.
 * Renders walls, doors, zones, safety areas, road network, shelves, stations, arms, and AGVs.
 */
export class SimScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly controls: OrbitControls;
  private readonly staticRoot = new THREE.Group();
  private readonly routeRoot = new THREE.Group();
  private readonly robotRoot = new THREE.Group();
  private readonly congestionRoot = new THREE.Group();
  private readonly bufferRoot = new THREE.Group();
  private readonly labelRoot = new THREE.Group();
  private readonly wallRoot = new THREE.Group();
  private readonly doorRoot = new THREE.Group();
  private readonly safetyRoot = new THREE.Group();
  private readonly roadRoot = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouse = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly agvMap = new Map<string, THREE.Group>();
  private readonly routeMap = new Map<string, RouteEntry>();
  private readonly armMap = new Map<string, ArmEntry>();
  private readonly congestionMeshes: THREE.Mesh[] = [];
  private readonly agvLabelMap = new Map<string, CSS2DObject>();
  private readonly batteryLabelMap = new Map<string, CSS2DObject>();

  private transform: WarehouseTransform;
  private props: SimView3DProps;
  private worldW = 14;
  private worldH = 10;
  private camTarget = new THREE.Vector3(7, 0, 5);
  private animId = 0;
  private staticSignature = '';
  private congestionSignature = '';
  private bufferSignature = '';
  private wallSignature = '';
  private safetySignature = '';
  private roadSignature = '';
  private hoveredRobotId: string | null = null;
  private entranceTL: gsap.core.Timeline | null = null;
  private lastSnapshotTime = 0;

  constructor(
    private readonly container: HTMLElement,
    props: SimView3DProps,
  ) {
    this.props = props;
    this.transform = new WarehouseTransform(props.layout, WORLD_W, WORLD_H);

    this.scene.background = new THREE.Color('#071426');
    this.scene.fog = new THREE.Fog('#071426', 15, 30);
    this.scene.add(
      this.staticRoot,
      this.routeRoot,
      this.robotRoot,
      this.congestionRoot,
      this.bufferRoot,
      this.labelRoot,
      this.wallRoot,
      this.doorRoot,
      this.safetyRoot,
      this.roadRoot,
    );

    const aspect = (props.width ?? 800) / (props.height ?? 520);
    const viewSize = viewHeightFor(aspect);
    this.camera = new THREE.OrthographicCamera(
      (-viewSize * aspect) / 2,
      (viewSize * aspect) / 2,
      viewSize / 2,
      -viewSize / 2,
      0.1,
      100,
    );
    this.camera.position.copy(CAMERA_HOME);
    this.camera.lookAt(CAMERA_TARGET);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(props.width ?? 800, props.height ?? 520);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(props.width ?? 800, props.height ?? 520);
    Object.assign(this.labelRenderer.domElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
    });
    this.container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minZoom = 0.8;
    this.controls.maxZoom = 2.2;
    this.controls.minPolarAngle = Math.PI / 10;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minAzimuthAngle = -0.9;
    this.controls.maxAzimuthAngle = 0.9;
    this.controls.target.copy(CAMERA_TARGET);
    this.controls.update();

    this.addLights();
    this.syncStatic(props, true);
    this.syncBuffers(props, true);
    this.syncDynamic(props, true);
    this.syncWallsAndDoors(true);
    this.syncRoadNetwork(true);
    this.syncSafetyAreas(true);
    this.playEntrance();
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.animate();
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight('#bfe8ff', '#07111f', 2.25));
    const sun = new THREE.DirectionalLight('#ffffff', 2.6);
    sun.position.set(WORLD_W / 2 - 3, 14, WORLD_H / 2 + 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 11;
    sun.shadow.camera.bottom = -8;
    this.scene.add(sun);
  }

  update(props: SimView3DProps): void {
    this.props = props;
    const nextTransform = new WarehouseTransform(props.layout, WORLD_W, WORLD_H);
    if (nextTransform.signature() !== this.transform.signature()) this.transform = nextTransform;
    this.syncStatic(props);
    this.syncBuffers(props);
    this.syncDynamic(props);
    this.syncWallsAndDoors();
    this.syncRoadNetwork();
    this.syncSafetyAreas();
    this.refreshRobotPresentation();
  }

  // ============================================================
  // Static elements: floor, zones, shelves, stations, arms
  // ============================================================

  private syncStatic(props: SimView3DProps, force = false): void {
    const signature = JSON.stringify({
      transform: this.transform.signature(),
      zones: props.zones,
      shelves: props.shelves ?? [],
      stations: props.stations,
      robotArms: props.robotArms ?? [],
    });
    if (!force && signature === this.staticSignature) return;

    for (const entry of this.armMap.values()) entry.animator.dispose();
    this.armMap.clear();
    this.disposeGroup(this.staticRoot);
    this.staticSignature = signature;

    this.staticRoot.add(createFloor(WORLD_W, WORLD_H));
    const anchorZoneLabels = new Set([
      '收货月台',
      '发货月台',
      '高位存储 A',
      '高位存储 B',
      '充电区',
      '维修区',
    ]);
    props.zones.forEach((zone) => {
      this.staticRoot.add(createZone(zone, this.transform));
      // Keep the default twin view quiet: only large navigation anchors stay visible.
      // Operational detail is available through equipment selection and the side panels.
      if (!anchorZoneLabels.has(zone.label)) return;
      const label = this.createLabel(zone.label, zone.color, 'zone');
      const position = this.transform.point(zone.x + 12, zone.y + 18, 0.12);
      label.position.copy(position);
      this.staticRoot.add(label);
    });

    (props.shelves ?? []).forEach((shelf) => {
      const object = createShelf(shelf.x, shelf.y, shelf.w, shelf.h, shelf.color, this.transform, shelf.levels);
      object.userData = { ...object.userData, isShelf: true, id: shelf.id };
      this.staticRoot.add(object);
    });

    props.stations.forEach((station) => {
      const isCharger = station.type === 'charge';
      this.staticRoot.add(
        createStation(
          station.x,
          station.y,
          station.label,
          station.type,
          station.color,
          this.transform,
          isCharger,
        ),
      );
    });

    const hasHandlingTask = (props.agvs ?? []).some((agv) => agv.state === 'loading' || agv.state === 'unloading');
    (props.robotArms ?? []).forEach((armData) => {
      const arm = createRobotArm();
      arm.position.copy(this.transform.point(armData.x, armData.y));
      this.staticRoot.add(arm);
      // Runtime activity, rather than a decorative infinite loop, decides
      // whether a physical arm performs a pick/place animation.
      const state = armData.state ?? (hasHandlingTask ? 'working' : 'idle');
      const animator = new ArmAnimator(arm);
      animator.setState(state);
      this.armMap.set(armData.id, { animator, state });
    });
  }

  // ============================================================
  // Buffer zones
  // ============================================================

  private syncBuffers(props: SimView3DProps, force = false): void {
    if (!props.buffers || props.buffers.length === 0) return;
    const sig = JSON.stringify(props.buffers);
    if (!force && sig === this.bufferSignature) return;
    this.bufferSignature = sig;
    this.disposeGroup(this.bufferRoot);

    for (const buf of props.buffers) {
      this.bufferRoot.add(createBufferZone(buf.x, buf.y, buf.w, buf.h, '#64748b', this.transform));
    }
  }

  // ============================================================
  // Dynamic elements: AGVs, routes, congestion
  // ============================================================

  private syncDynamic(props: SimView3DProps, force = false): void {
    const validAgvIds = new Set(props.agvs?.map((a) => a.id) ?? []);

    // Remove stale AGVs
    for (const [id, agv] of this.agvMap) {
      if (!validAgvIds.has(id)) {
        this.robotRoot.remove(agv);
        this.disposeObject(agv);
        this.agvMap.delete(id);
        const lbl = this.agvLabelMap.get(id);
        if (lbl) {
          this.labelRoot.remove(lbl);
          this.agvLabelMap.delete(id);
        }
        const btl = this.batteryLabelMap.get(id);
        if (btl) {
          this.labelRoot.remove(btl);
          this.batteryLabelMap.delete(id);
        }
      }
    }

    // Remove stale routes
    for (const [id, route] of this.routeMap) {
      if (!validAgvIds.has(id)) {
        this.routeRoot.remove(route.line);
        this.disposeObject(route.line);
        this.routeMap.delete(id);
      }
    }

    // Sync each AGV
    (props.agvs ?? []).forEach((agvData) => this.syncAGV(agvData, force));

    // Sync arm states
    const hasHandlingTask = (props.agvs ?? []).some((agv) => agv.state === 'loading' || agv.state === 'unloading');
    for (const [id, arm] of this.armMap) {
      const armData = props.robotArms?.find((item) => item.id === id);
      const desired = armData?.state ?? (hasHandlingTask ? 'working' : 'idle');
      if (desired !== arm.state) {
        arm.animator.setState(desired);
        arm.state = desired;
      }
    }

    this.syncCongestion(props, force);
  }

  private syncAGV(agvData: NonNullable<SimView3DProps['agvs']>[0], force = false): void {
    const pose = this.getAgvPose(agvData);
    if (!pose) return;

    const routeSignature = JSON.stringify({
      path: agvData.route,
      color: AGV_STATE_COLORS[agvData.state as AgvState] || '#94a3b8',
    });
    const oldRoute = this.routeMap.get(agvData.id);
    if (force || !oldRoute || oldRoute.signature !== routeSignature) {
      if (oldRoute) {
        this.routeRoot.remove(oldRoute.line);
        this.disposeObject(oldRoute.line);
      }

      const line = createPathLine(
        agvData.route,
        AGV_STATE_COLORS[agvData.state as AgvState] || '#94a3b8',
        this.transform,
      );
      if (agvData.state === 'blocked') {
        (line.material as THREE.LineDashedMaterial).color.set('#ef4444');
      }
      line.userData.robotId = agvData.id;
      this.routeRoot.add(line);
      this.routeMap.set(agvData.id, { line, signature: routeSignature });
    }

    // AGV model
    let agv = this.agvMap.get(agvData.id);
    if (!agv) {
      agv = createAGVByType(agvData.color || '#06b6d4', agvData.state as AgvState, agvData.type);
      agv.userData = { id: agvData.id, isAGV: true, state: agvData.state as AgvState };
      agv.position.copy(pose.position);
      agv.rotation.y = pose.rotation;
      setAGVState(agv, agvData.state as AgvState, agvData.battery);
      this.agvMap.set(agvData.id, agv);
      this.robotRoot.add(agv);

      // Name label (hidden by default, shown on hover/select)
      const nameLabel = this.createLabel(
        agvData.name || agvData.id,
        AGV_STATE_GLOW[agvData.state as AgvState] || '#94a3b8',
      );
      nameLabel.position.set(0, 0.55, 0);
      nameLabel.visible = false;
      agv.add(nameLabel);
      agv.userData.label = nameLabel;
      this.agvLabelMap.set(agvData.id, nameLabel);

      // Battery label
      const batteryLabel = this.createBatteryLabel(agvData.battery ?? 100);
      batteryLabel.position.set(0.35, 0.3, 0);
      batteryLabel.visible = false;
      agv.add(batteryLabel);
      this.batteryLabelMap.set(agvData.id, batteryLabel);
    }

    agv!.userData.targetPosition = pose.position;
    agv!.userData.targetRotation = pose.rotation;

    const state = agvData.state as AgvState;
    if (agv!.userData.state !== state) {
      agv!.userData.state = state;
      setAGVState(agv!, state, agvData.battery);
      const route = this.routeMap.get(agvData.id);
      if (route) {
        (route.line.material as THREE.LineDashedMaterial).color.set(
          state === 'blocked' ? '#ef4444' : AGV_STATE_COLORS[state] || '#94a3b8',
        );
      }
    }

    // Cargo is created at the actual loading transition, not only when the
    // AGV model first mounts. Scale animation makes load/unload readable.
    let cargoMesh = agv!.getObjectByName('cargo-on-agv') as THREE.Group | undefined;
    if (agvData.loadStatus === 'loaded' && !cargoMesh) {
      const cargoType = agvData.type === 'pallet_amr' ? 'pallet' : 'tote';
      cargoMesh = createCargo(cargoType, true);
      cargoMesh.position.set(0, agvData.type === 'pallet_amr' ? 0.17 : 0.15, 0);
      cargoMesh.name = 'cargo-on-agv';
      cargoMesh.scale.setScalar(0.01);
      agv!.add(cargoMesh);
      gsap.to(cargoMesh.scale, { x: 1, y: 1, z: 1, duration: 0.38, ease: 'back.out(1.7)' });
    } else if (agvData.loadStatus === 'loaded' && cargoMesh && !cargoMesh.visible) {
      cargoMesh.visible = true;
      cargoMesh.scale.setScalar(0.01);
      gsap.to(cargoMesh.scale, { x: 1, y: 1, z: 1, duration: 0.34, ease: 'back.out(1.6)' });
    } else if (agvData.loadStatus === 'empty' && cargoMesh && cargoMesh.visible) {
      cargoMesh.visible = false;
      cargoMesh.scale.setScalar(1);
    }

    const btl = this.batteryLabelMap.get(agvData.id);
    if (btl) {
      btl.element.textContent = `${agvData.battery?.toFixed(0) ?? 100}%`;
      btl.userData.lowBattery = agvData.battery !== undefined && agvData.battery <= 15;
      if (agvData.battery !== undefined && agvData.battery <= 15) {
        btl.element.style.color = '#ef4444';
        btl.element.style.fontWeight = '700';
      } else {
        btl.element.style.color = '#fff';
        btl.element.style.fontWeight = '600';
      }
    }
  }

  private syncCongestion(props: SimView3DProps, force = false): void {
    const congestionData = props.congestion ?? [];
    const signature = JSON.stringify(congestionData);
    if (!force && signature === this.congestionSignature) return;
    this.disposeGroup(this.congestionRoot);
    this.congestionMeshes.length = 0;
    this.congestionSignature = signature;

    congestionData.forEach((item) => {
      const mesh = createCongestion(
        item.x,
        item.y,
        item.radius,
        item.intensity,
        this.transform,
        item.avgWaitSeconds ?? 0,
      );
      this.congestionRoot.add(mesh);
      this.congestionMeshes.push(mesh);

      if (item.avgWaitSeconds && item.avgWaitSeconds > 0) {
        const label = this.createLabel(`${item.avgWaitSeconds}s`, '#ef4444');
        const pos = this.transform.point(item.x, item.y, 0.15);
        label.position.copy(pos);
        this.congestionRoot.add(label);
      }
    });
  }

  // ============================================================
  // Walls & Doors from warehouse config
  // ============================================================

  private syncWallsAndDoors(force = false): void {
    const wc = this.props.warehouseConfig;
    const sig = JSON.stringify({
      walls: wc.walls.map(
        (w) => `${w.id}_${w.type}_${w.start.x}_${w.start.y}_${w.end.x}_${w.end.y}_${w.height}`,
      ),
      doors: wc.doors.map((d) => `${d.id}_${d.type}_${d.position.x}_${d.position.y}_${d.width}`),
    });
    if (!force && sig === this.wallSignature) return;
    this.wallSignature = sig;

    this.disposeGroup(this.wallRoot);
    this.disposeGroup(this.doorRoot);

    wc.walls.forEach((wall) => {
      this.wallRoot.add(createWallSegment(wall, this.transform));
    });

    wc.doors.forEach((door) => {
      this.doorRoot.add(createDoor(door, this.transform, WORLD_W));
    });
  }

  // ============================================================
  // Safety areas from warehouse config
  // ============================================================

  private syncSafetyAreas(force = false): void {
    const wc = this.props.warehouseConfig;
    const sig = JSON.stringify(wc.safetyAreas);
    if (!force && sig === this.safetySignature) return;
    this.safetySignature = sig;
    this.disposeGroup(this.safetyRoot);

    wc.safetyAreas.forEach((area) => {
      this.safetyRoot.add(createSafetyArea(area, this.transform));
    });
  }

  // ============================================================
  // Road network visualization from warehouse config
  // ============================================================

  private syncRoadNetwork(force = false): void {
    const wc = this.props.warehouseConfig;
    const sig = JSON.stringify({
      nodes: Array.from(wc.roadNetwork.nodes.values()).map(
        (n) => `${n.id}_${n.position.x}_${n.position.y}`,
      ),
    });
    if (!force && sig === this.roadSignature) return;
    this.roadSignature = sig;

    this.disposeGroup(this.roadRoot);

    // Only semantic entry nodes are visible. Junction dots created visual
    // noise and made the scene look like an editor grid instead of a twin.
    for (const [, node] of wc.roadNetwork.nodes) {
      if (node.type === 'junction') continue;
      const pos = this.transform.point(node.position.x, node.position.y);
      const geo = new THREE.RingGeometry(0.045, 0.075, 16);
      const mat = new THREE.MeshBasicMaterial({
        color:
          node.type === 'station_entry'
            ? '#f59e0b'
            : node.type === 'charger_entry'
              ? '#8b5cf6'
              : node.type === 'buffer_entry'
                ? '#ec4899'
                : '#94a3b8',
        transparent: true,
        opacity: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pos.x, 0.03, pos.z);
      this.roadRoot.add(mesh);
    }

    // Render each bidirectional pair once as a physical lane band.
    const renderedPairs = new Set<string>();
    for (const [, edge] of wc.roadNetwork.edges) {
      const pairKey = [edge.from, edge.to].sort().join('|');
      if (renderedPairs.has(pairKey)) continue;
      renderedPairs.add(pairKey);
      const fromNode = wc.roadNetwork.nodes.get(edge.from);
      const toNode = wc.roadNetwork.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;

      const fromPt = this.transform.point(fromNode.position.x, fromNode.position.y);
      const toPt = this.transform.point(toNode.position.x, toNode.position.y);

      const dx = toPt.x - fromPt.x;
      const dz = toPt.z - fromPt.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.018, length),
        new THREE.MeshStandardMaterial({
          color: edge.isBlocked ? '#7f1d1d' : '#16324d',
          roughness: 0.92,
          transparent: true,
          opacity: edge.isBlocked ? 0.88 : 0.72,
        }),
      );
      road.position.set((fromPt.x + toPt.x) / 2, 0.012, (fromPt.z + toPt.z) / 2);
      road.rotation.y = -Math.atan2(dx, dz);
      road.receiveShadow = true;
      this.roadRoot.add(road);

      const markerGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(fromPt.x, 0.028, fromPt.z),
        new THREE.Vector3(toPt.x, 0.028, toPt.z),
      ]);
      const marker = new THREE.Line(
        markerGeometry,
        new THREE.LineDashedMaterial({
          color: edge.isBlocked ? '#fb7185' : '#67e8f9',
          dashSize: 0.16,
          gapSize: 0.12,
          transparent: true,
          opacity: edge.isBlocked ? 0.95 : 0.8,
        }),
      );
      marker.computeLineDistances();
      this.roadRoot.add(marker);
    }
  }

  // ============================================================
  // AGV pose calculation
  // ============================================================

  private getAgvPose(
    agvData: NonNullable<SimView3DProps['agvs']>[0],
  ): { position: THREE.Vector3; rotation: number } | null {
    const px = (agvData.position.x / this.props.layout.width) * WORLD_W;
    const pz = (agvData.position.y / this.props.layout.height) * WORLD_H;

    let rotation = 0;
    if (agvData.route && agvData.route.length >= 2) {
      const nextPt = agvData.route[1];
      const dx = nextPt[0] - agvData.position.x;
      const dz = nextPt[1] - agvData.position.y;
      rotation = Math.atan2(dx, dz);
    } else if (agvData.route && agvData.route.length === 1) {
      const pt = agvData.route[0];
      const dx = pt[0] - agvData.position.x;
      const dz = pt[1] - agvData.position.y;
      rotation = Math.atan2(dx, dz);
    }

    return {
      position: new THREE.Vector3(px, 0.1, pz),
      rotation,
    };
  }

  // ============================================================
  // Label creation
  // ============================================================

  private createLabel(
    text: string,
    color: string,
    kind: 'plain' | 'zone' | 'buffer' = 'plain',
  ): CSS2DObject {
    const element = document.createElement('div');
    element.textContent = text;
    const isChip = kind !== 'plain';
    Object.assign(element.style, {
      color: kind === 'zone' ? '#0f172a' : color,
      fontSize: kind === 'zone' ? '10px' : '9px',
      fontWeight: '700',
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
      textShadow: isChip ? 'none' : '0 1px 8px rgba(255,255,255,0.9)',
      transform: 'translate(0, -50%)',
      background: isChip ? 'rgba(255,255,255,0.82)' : 'transparent',
      border: isChip ? `1px solid ${color}55` : 'none',
      borderLeft: kind === 'zone' ? `3px solid ${color}` : undefined,
      borderRadius: '6px',
      padding: isChip ? '3px 7px' : '0',
      boxShadow: isChip ? '0 4px 12px rgba(15,23,42,0.08)' : 'none',
      pointerEvents: 'none',
      backdropFilter: isChip ? 'blur(6px)' : undefined,
    });
    return new CSS2DObject(element);
  }

  private createBatteryLabel(battery: number): CSS2DObject {
    const element = document.createElement('div');
    element.textContent = `${battery.toFixed(0)}%`;
    Object.assign(element.style, {
      color: '#fff',
      fontSize: '9px',
      fontWeight: '600',
      whiteSpace: 'nowrap',
      textShadow: '0 1px 4px rgba(0,0,0,0.8)',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(15,23,42,0.7)',
      borderRadius: '4px',
      padding: '1px 4px',
    });
    return new CSS2DObject(element);
  }

  // ============================================================
  // Animation loop
  // ============================================================

  private playEntrance(): void {
    this.entranceTL?.kill();
    this.entranceTL = gsap.timeline({ defaults: { ease: 'power3.out' } });
    this.entranceTL
      .fromTo(this.staticRoot.scale, { y: 0.04 }, { y: 1, duration: 0.75 }, 0)
      .fromTo(this.wallRoot.scale, { y: 0.04 }, { y: 1, duration: 0.62 }, 0.08)
      .fromTo(this.robotRoot.position, { y: 0.45 }, { y: 0, duration: 0.72 }, 0.18)
      .fromTo(
        this.robotRoot.scale,
        { x: 0.86, y: 0.86, z: 0.86 },
        { x: 1, y: 1, z: 1, duration: 0.72 },
        0.18,
      )
      .to(
        this.camera.position,
        {
          x: CAMERA_HOME.x,
          y: CAMERA_HOME.y,
          z: CAMERA_HOME.z,
          duration: 1.05,
        },
        0,
      );
  }

  private refreshRobotPresentation(): void {
    for (const [id, agv] of this.agvMap) {
      const highlighted = id === this.hoveredRobotId || id === this.props.selectedRobotId;
      const scale = id === this.props.selectedRobotId ? 1.16 : highlighted ? 1.08 : 1;
      gsap.to(agv.scale, {
        x: scale,
        y: scale,
        z: scale,
        duration: 0.28,
        ease: 'power2.out',
        overwrite: true,
      });
      const label = agv.userData.label as CSS2DObject | undefined;
      if (label) label.visible = highlighted;
      const battery = this.batteryLabelMap.get(id);
      if (battery) battery.visible = highlighted || Boolean(battery.userData.lowBattery);
    }
  }

  private findRobotAtEvent(event: PointerEvent): THREE.Group | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects([...this.agvMap.values()], true)[0];
    if (!hit) return null;
    let current: THREE.Object3D | null = hit.object;
    while (current && !current.userData?.isAGV) current = current.parent;
    return current instanceof THREE.Group ? current : null;
  }

  private findShelfAtEvent(event: PointerEvent): THREE.Object3D | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.staticRoot.children, true);
    for (const hit of hits) {
      let current: THREE.Object3D | null = hit.object;
      while (current && !current.userData?.isShelf) current = current.parent;
      if (current?.userData?.isShelf) return current;
    }
    return null;
  }

  private onPointerDown = (event: PointerEvent): void => {
    const robot = this.findRobotAtEvent(event);
    if (robot) {
      this.props.onSelectRobot?.(robot.userData.id as string);
      gsap.to(this.controls.target, {
        x: robot.position.x,
        y: 0,
        z: robot.position.z,
        duration: 0.65,
        ease: 'power3.out',
        overwrite: true,
      });
      return;
    }
    const shelf = this.findShelfAtEvent(event);
    if (shelf) this.props.onSelectShelf?.(shelf.userData.id as string);
  };

  private onPointerMove = (event: PointerEvent): void => {
    const robot = this.findRobotAtEvent(event);
    const nextId = robot?.userData.id as string | undefined;
    if ((nextId ?? null) === this.hoveredRobotId) return;
    this.hoveredRobotId = nextId ?? null;
    this.renderer.domElement.style.cursor = nextId ? 'pointer' : '';
    this.refreshRobotPresentation();
  };

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      cancelAnimationFrame(this.animId);
      this.animId = 0;
    } else if (!this.animId) {
      this.clock.getDelta();
      this.animate();
    }
  };

  resetCamera(): void {
    gsap.to(this.controls.target, {
      x: CAMERA_TARGET.x,
      y: 0,
      z: CAMERA_TARGET.z,
      duration: 0.45,
      ease: 'power2.out',
    });
    gsap.to(this.camera.position, {
      x: CAMERA_HOME.x,
      y: CAMERA_HOME.y,
      z: CAMERA_HOME.z,
      duration: 0.45,
      ease: 'power2.out',
    });
  }

  topView(): void {
    gsap.to(this.controls.target, {
      x: CAMERA_TARGET.x,
      y: 0,
      z: CAMERA_TARGET.z,
      duration: 0.4,
      ease: 'power2.out',
    });
    gsap.to(this.camera.position, {
      x: WORLD_W / 2,
      y: 16,
      z: WORLD_H / 2 + 0.01,
      duration: 0.4,
      ease: 'power2.out',
    });
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    const aspect = width / height;
    const viewSize = viewHeightFor(aspect);
    this.camera.left = (-viewSize * aspect) / 2;
    this.camera.right = (viewSize * aspect) / 2;
    this.camera.top = viewSize / 2;
    this.camera.bottom = -viewSize / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
  }

  private animate = (): void => {
    this.animId = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;

    // Smooth AGV positions
    const alpha = 1 - Math.exp(-12 * delta);
    for (const agv of this.agvMap.values()) {
      const target = agv.userData.targetPosition as THREE.Vector3 | undefined;
      const targetRotation = agv.userData.targetRotation as number | undefined;
      if (target) {
        const moved = agv.position.distanceTo(target);
        agv.position.lerp(target, alpha);
        if (moved > 0.002) {
          agv.traverse((child) => {
            if (child.name === 'agv-wheel') child.rotation.z -= Math.min(moved, 0.08) * 8;
          });
        }
      }
      if (targetRotation !== undefined) {
        const difference =
          THREE.MathUtils.euclideanModulo(targetRotation - agv.rotation.y + Math.PI, Math.PI * 2) -
          Math.PI;
        agv.rotation.y += difference * alpha;
      }
    }

    // Pulsing routes make activity readable without permanent text labels.
    for (const route of this.routeMap.values()) {
      const material = route.line.material as THREE.LineDashedMaterial;
      material.transparent = true;
      material.opacity = 0.62 + Math.sin(elapsed * 3.2) * 0.22;
    }

    // Fault flashing
    for (const agv of this.agvMap.values()) {
      updateFaultFlash(agv, elapsed);
    }

    // Charging particles
    for (const agv of this.agvMap.values()) {
      const particles = agv.getObjectByName('charge-particles') as THREE.Group | undefined;
      if (particles && particles.visible) {
        particles.children.forEach((child, i) => {
          if (child instanceof THREE.Mesh) {
            const angle = elapsed * 3 + (i / 6) * Math.PI * 2;
            child.position.x = Math.cos(angle) * 0.15;
            child.position.z = Math.sin(angle) * 0.15;
            child.position.y = 0.1 + Math.sin(elapsed * 2 + i) * 0.03;
          }
        });
      }
    }

    // Congestion pulsing
    this.congestionMeshes.forEach((mesh) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      const base = mesh.userData.baseOpacity as number;
      material.opacity =
        base +
        Math.sin(elapsed * 2 + (mesh.userData.pulseOffset as number)) * Math.min(base * 0.35, 0.12);
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };

  // ============================================================
  // Cleanup
  // ============================================================

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      }
    });
  }

  private disposeGroup(group: THREE.Group): void {
    [...group.children].forEach((child) => {
      group.remove(child);
      this.disposeObject(child);
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.animId);
    this.entranceTL?.kill();
    for (const arm of this.armMap.values()) arm.animator.dispose();
    this.armMap.clear();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.disposeGroup(this.staticRoot);
    this.disposeGroup(this.routeRoot);
    this.disposeGroup(this.robotRoot);
    this.disposeGroup(this.congestionRoot);
    this.disposeGroup(this.bufferRoot);
    this.disposeGroup(this.labelRoot);
    this.disposeGroup(this.wallRoot);
    this.disposeGroup(this.doorRoot);
    this.disposeGroup(this.safetyRoot);
    this.disposeGroup(this.roadRoot);
    this.controls.dispose();
    this.renderer.dispose();
    this.labelRenderer.domElement.remove();
    if (this.container.contains(this.renderer.domElement))
      this.container.removeChild(this.renderer.domElement);
  }
}

// ============================================================
// 3D helpers for walls, doors, safety areas
// ============================================================

function createWallSegment(wall: WallSegment, transform: WarehouseTransform): THREE.Group {
  const group = new THREE.Group();
  const start = transform.point(wall.start.x, wall.start.y);
  const end = transform.point(wall.end.x, wall.end.y);

  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  // Cutaway digital-twin walls: enough height for spatial context without
  // hiding equipment in top/isometric views.
  const height3D =
    wall.type === WallType.EXTERIOR ? 0.52 : wall.type === WallType.INTERIOR ? 0.28 : 0.2;

  let color = '#94a3b8';
  if (wall.type === WallType.EXTERIOR) color = '#64748b';
  else if (wall.type === WallType.INTERIOR) color = '#cbd5e1';
  else if (wall.type === WallType.FIRE_EXIT) color = '#ef4444';
  else if (wall.type === WallType.PERSONNEL_GATE) color = '#22c55e';

  const wallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(wall.type === WallType.EXTERIOR ? 0.075 : 0.045, height3D, length),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.12,
      transparent: true,
      opacity: wall.type === WallType.EXTERIOR ? 0.84 : 0.62,
    }),
  );
  wallMesh.position.set((start.x + end.x) / 2, height3D / 2, (start.z + end.z) / 2);
  wallMesh.rotation.y = -angle;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);

  return group;
}

function createDoor(door: Door, transform: WarehouseTransform, worldW: number): THREE.Group {
  const group = new THREE.Group();
  const pos = transform.point(door.position.x, door.position.y);

  let color = '#f59e0b';
  if (door.type === DoorType.PERSONNEL) color = '#22c55e';
  else if (door.type === DoorType.FIRE_EXIT) color = '#ef4444';

  // Door frame
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.5, (door.width / 1200) * worldW),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.7,
    }),
  );
  frame.position.set(pos.x, 0.25, pos.z);
  group.add(frame);

  // Door indicator light
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshBasicMaterial({ color: door.isOpen ? '#22c55e' : '#ef4444' }),
  );
  light.position.set(pos.x, 0.55, pos.z);
  group.add(light);

  return group;
}

function createSafetyArea(
  area: { x: number; y: number; w: number; h: number },
  transform: WarehouseTransform,
): THREE.Group {
  const group = new THREE.Group();
  const center = transform.point(area.x + area.w / 2, area.y + area.h / 2);
  const { width: w3, height: h3 } = transform.size(area.w, area.h);

  // Dashed boundary
  const geo = new THREE.PlaneGeometry(w3, h3);
  const mat = new THREE.MeshBasicMaterial({
    color: '#f59e0b',
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(center.x, 0.03, center.z);
  group.add(plane);

  // Dashed border line
  const edges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w3, h3));
  const lineMat = new THREE.LineDashedMaterial({
    color: '#f59e0b',
    dashSize: 0.15,
    gapSize: 0.08,
    transparent: true,
    opacity: 0.5,
  });
  const border = new THREE.LineSegments(edges, lineMat);
  border.rotation.x = -Math.PI / 2;
  border.position.set(center.x, 0.04, center.z);
  border.computeLineDistances();
  group.add(border);

  return group;
}
