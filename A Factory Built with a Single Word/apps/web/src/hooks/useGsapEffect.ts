/**
 * useGSAP：在 React 组件中使用 GSAP 动画
 *
 * 使用方式：
 *   useGsapEffect(() => {
 *     fadeInUp('.hero-title');
 *     staggerCards('.kpi-card', 0.08);
 *   }, [deps]);
 */
import { useEffect, type DependencyList } from 'react';

export function useGsapEffect(fn: () => void | (() => void), deps: DependencyList = []) {
  useEffect(() => {
    // 延迟一帧确保 DOM 已渲染
    const id = requestAnimationFrame(() => {
      const cleanup = fn();
      return cleanup;
    });
    return () => cancelAnimationFrame(id);
  }, deps);
}
