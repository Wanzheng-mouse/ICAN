import type * as THREE from 'three';
import gsap from 'gsap';

/**
 * 机械臂 GSAP 动画器
 *
 * 两种模式：
 * - idle: 关节轻微摆动 + 整体微动
 * - working: J1旋转 + J2/J3 伸缩 + 夹爪开合
 */
export class ArmAnimator {
  private arm: THREE.Group;
  private idleTL: gsap.core.Timeline | null = null;
  private workTL: gsap.core.Timeline | null = null;
  private state: 'idle' | 'working' = 'idle';

  constructor(arm: THREE.Group) {
    this.arm = arm;
    if (!this.reducedMotion()) this.startIdle();
  }

  private reducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private getJoint(name: string): THREE.Group | null {
    return this.arm.getObjectByName(name) as THREE.Group | null;
  }

  startIdle(): void {
    this.state = 'idle';
    this.workTL?.kill();
    this.idleTL?.kill();

    const j1 = this.getJoint('arm-J1');
    const j2 = this.getJoint('arm-J2');
    const j3 = this.getJoint('arm-J3');
    const j6 = this.getJoint('arm-J6');

    if (this.reducedMotion()) return;
    this.idleTL = gsap.timeline({ repeat: -1, yoyo: true });

    // J1 缓慢旋转 ±8°
    if (j1) {
      j1.rotation.y = 0;
      this.idleTL.to(j1.rotation, { y: 0.15, duration: 3, ease: 'sine.inOut' }, 0);
    }
    // J2 微小的俯仰
    if (j2) {
      this.idleTL.to(j2.rotation, { z: 0.05, duration: 2.5, ease: 'sine.inOut' }, 0.3);
    }
    // J3 微小的俯仰
    if (j3) {
      this.idleTL.to(j3.rotation, { z: 0.08, duration: 2.8, ease: 'sine.inOut' }, 0.6);
    }
    // J6 夹爪微微开合
    if (j6) {
      this.idleTL.to(j6.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 1.5, ease: 'sine.inOut' }, 1.0);
    }
    // 整体微动
    this.idleTL.to(this.arm.rotation, { y: 0.06, duration: 3.5, ease: 'sine.inOut' }, 0);
  }

  startWorking(): void {
    this.state = 'working';
    this.idleTL?.kill();
    if (this.reducedMotion()) return;
    this.workTL?.kill();

    const j1 = this.getJoint('arm-J1');
    const j2 = this.getJoint('arm-J2');
    const j3 = this.getJoint('arm-J3');
    const j6 = this.getJoint('arm-J6');

    // A complete pick/place cycle: scan → reach → grip → lift → transfer →
    // release → home. GSAP synchronises all six joints on one time axis.
    this.workTL = gsap.timeline({ repeat: -1, repeatDelay: 0.45, defaults: { ease: 'power2.inOut' } });
    if (j1) this.workTL.to(j1.rotation, { y: Math.PI / 3.4, duration: 0.9 }, 0);
    if (j2) this.workTL.to(j2.rotation, { z: -0.5, duration: 0.72 }, 0.12);
    if (j3) this.workTL.to(j3.rotation, { z: 0.38, duration: 0.72 }, 0.2);
    if (j6) this.workTL.to(j6.scale, { x: 0.62, y: 0.82, z: 0.62, duration: 0.24, ease: 'power1.in' }, 0.82);

    if (j2) this.workTL.to(j2.rotation, { z: -0.18, duration: 0.5 }, 1.12);
    if (j3) this.workTL.to(j3.rotation, { z: 0.12, duration: 0.5 }, 1.12);
    if (j1) this.workTL.to(j1.rotation, { y: -Math.PI / 3.8, duration: 1.05 }, 1.18);

    if (j2) this.workTL.to(j2.rotation, { z: -0.42, duration: 0.48 }, 2.12);
    if (j3) this.workTL.to(j3.rotation, { z: 0.34, duration: 0.48 }, 2.12);
    if (j6) this.workTL.to(j6.scale, { x: 1, y: 1, z: 1, duration: 0.28, ease: 'back.out(1.6)' }, 2.56);

    if (j1) this.workTL.to(j1.rotation, { y: 0, duration: 0.86 }, 2.88);
    if (j2) this.workTL.to(j2.rotation, { z: 0, duration: 0.72 }, 2.9);
    if (j3) this.workTL.to(j3.rotation, { z: 0, duration: 0.72 }, 2.9);
  }

  setState(state: 'idle' | 'working'): void {
    if (state === this.state) return;
    if (state === 'idle') this.startIdle();
    else this.startWorking();
  }

  dispose(): void {
    this.idleTL?.kill();
    this.workTL?.kill();
    gsap.killTweensOf(this.arm);
  }
}
