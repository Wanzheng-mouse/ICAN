import { useEffect, useRef } from 'react';
import { init } from 'echarts';

interface EChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  option: any;
  height?: number | string;
  width?: number | string;
  className?: string;
  onClick?: (params: unknown) => void;
}

/**
 * 自研 ECharts 封装 · 解决 echarts-for-react 在某些环境下
 * canvas 高度为 0 导致"只有坐标轴、没有图形"的问题。
 *
 * - 直接使用 echarts 原生 API，避免二次封装带来的尺寸计算问题
 * - ResizeObserver 监听容器变化自动 resize
 * - 主题：light
 */
export function EChart({ option, height = 320, width = '100%', className, onClick }: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = init(el, undefined, {
      renderer: 'canvas',
    });
    chartRef.current = chart;

    const handleClick = (params: unknown) => onClick?.(params);
    chart.on('click', handleClick);

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);

    return () => {
      chart.off('click', handleClick);
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [onClick]);

  useEffect(() => {
    if (chartRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chartRef.current as any).setOption(option, { notMerge: true, lazyUpdate: false });
    }
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width, height, minHeight: 200 }}
    />
  );
}
