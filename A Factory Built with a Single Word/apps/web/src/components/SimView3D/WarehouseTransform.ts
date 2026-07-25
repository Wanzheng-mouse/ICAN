import * as THREE from 'three';
import type { WarehouseLayout3D } from './types';

/** Shared conversion between editor coordinates and the Three.js world. */
export class WarehouseTransform {
  readonly worldWidth: number;
  readonly worldHeight: number;

  constructor(
    readonly layout: WarehouseLayout3D,
    worldWidth = 14,
    worldHeight = 10,
  ) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  point(x: number, y: number, elevation = 0): THREE.Vector3 {
    return new THREE.Vector3(
      (x / this.layout.width) * this.worldWidth,
      elevation,
      (y / this.layout.height) * this.worldHeight,
    );
  }

  size(width: number, height: number): { width: number; height: number } {
    return {
      width: (width / this.layout.width) * this.worldWidth,
      height: (height / this.layout.height) * this.worldHeight,
    };
  }

  signature(): string {
    return `${this.layout.width}x${this.layout.height}:${this.worldWidth}x${this.worldHeight}`;
  }
}
