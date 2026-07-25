import { useEffect, useRef } from 'react';
import { SimScene } from './SimScene';
import type { SimView3DProps } from './types';

export type { SimView3DProps, Agv3D } from './types';
export { SimulationEngine } from './simulationEngine';
export type { SimulationSnapshot, AgvState } from './types';
export { AGV_STATE_COLORS, AGV_STATE_GLOW } from './types';

/**
 * React 包裹层
 * - 挂载时创建 SimScene
 * - props 变化时调用 scene.update()
 * - 卸载时 scene.dispose()
 * - resize 自适应
 */
export function SimView3D(props: SimView3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SimScene | null>(null);
  const width = props.width ?? 800;
  const height = props.height ?? 520;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const scene = new SimScene(el, props);
    sceneRef.current = scene;

    const onResize = () => {
      if (!el) return;
      const w = el.clientWidth || width;
      const h = el.clientHeight || height;
      scene.resize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.update(props);
  }, [
    props.layout, props.agvs, props.robots, props.congestion, props.zones, props.shelves,
    props.warehouseConfig, props.stations, props.robotArms, props.buffers, props.running,
    props.selectedRobotId, props.onSelectRobot,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 10,
        background: '#071426',
      }}
    >
      <div
        aria-label="三维视图控制"
        style={{
          position: 'absolute', right: 12, top: 12, zIndex: 2, display: 'flex', gap: 6,
          padding: 4, borderRadius: 8, background: 'rgba(255,255,255,0.86)',
          border: '1px solid rgba(203,213,225,0.9)', boxShadow: '0 6px 16px rgba(15,23,42,0.08)',
        }}
      >
        <button type="button" className="sim-view-control" onClick={() => sceneRef.current?.resetCamera()}>
          等轴测
        </button>
        <button type="button" className="sim-view-control" onClick={() => sceneRef.current?.topView()}>
          顶视图
        </button>
      </div>
    </div>
  );
}
