import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AimOutlined,
  AlertOutlined,
  CaretRightOutlined,
  FullscreenOutlined,
  PauseOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { App, Button, Modal, Select, Skeleton, Space, Tag } from 'antd';
import { KpiCard, SectionCard } from '@/components';
import { formatSimTime, safeDeltaSeconds } from '@/utils/simTime';
import {
  useSimulationAgents,
  useSimulationEvents,
  useSimulationRun,
  useControlSimulation,
  useInjectAnomaly,
} from '@/api/modules';
import type { SimulationEvent } from '@ican/contracts';
import { consoleKpis, consoleSceneInfo, simulationLegend } from '@ican/mock-data';
import './index.css';

type SimStatus = 'idle' | 'running' | 'paused' | 'injected';

const levelIcon: Record<string, React.ReactNode> = {
  warn: <WarningOutlined style={{ color: '#f59e0b' }} />,
  info: <i className="event-dot info" />,
  success: <i className="event-dot success" />,
  error: <i className="event-dot error" />,
};

const ANOMALY_TYPES = [
  { key: 'road_closed', label: '道路封闭', color: '#ef4444' },
  { key: 'low_battery', label: '低电量', color: '#f59e0b' },
  { key: 'order_surge', label: '订单激增', color: '#a855f7' },
  { key: 'station_down', label: '站点故障', color: '#3b82f6' },
];

interface RobotAnim {
  id: string;
  path: number[][];
  speed: number;
  color: string;
  state: 'idle' | 'moving' | 'charging' | 'picking';
  progress: number;
}

export default function Simulation() {
  const { message } = App.useApp();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const [status, setStatus] = useState<SimStatus>('idle');
  const [speed, setSpeed] = useState(1);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [robots, setRobots] = useState<RobotAnim[]>([
    { id: 'A-067', path: [[0.12, 0.12], [0.30, 0.12], [0.30, 0.35], [0.60, 0.35], [0.60, 0.18]], speed: 0.0008, color: '#06b6d4', state: 'idle', progress: 0 },
    { id: 'A-118', path: [[0.65, 0.18], [0.85, 0.18], [0.85, 0.55], [0.42, 0.55], [0.42, 0.42]], speed: 0.0007, color: '#3b82f6', state: 'idle', progress: 0.2 },
    { id: 'A-025', path: [[0.18, 0.72], [0.45, 0.72], [0.45, 0.55], [0.78, 0.55], [0.78, 0.78]], speed: 0.0006, color: '#a855f7', state: 'idle', progress: 0.5 },
    { id: 'A-201', path: [[0.10, 0.42], [0.40, 0.42], [0.40, 0.78], [0.18, 0.78]], speed: 0.0005, color: '#ec4899', state: 'idle', progress: 0.7 },
  ]);
  const [simTime, setSimTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [pendingAnomaly, setPendingAnomaly] = useState<string>('road_closed');
  // 使用 ref 跟踪最后一次时间，避免闭包陷阱
  const lastTickRef = useRef<number>(0);

  // ===== 领域 API 接入 =====
  const { data: agentsData, isLoading: agentsLoading } = useSimulationAgents();
  const { data: eventsData, isLoading: eventsLoading } = useSimulationEvents();
  const { data: runData, isLoading: _runLoading } = useSimulationRun();
  const controlMutation = useControlSimulation();
  const injectMutation = useInjectAnomaly();

  // 初次加载事件
  useEffect(() => {
    if (eventsData && events.length === 0) setEvents(eventsData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsData]);

  const agents = agentsData ?? [];
  const run = runData;

  const kpis = useMemo(() => {
    return consoleKpis.map((k) => {
      if (status === 'running') {
        return { ...k, value: typeof k.value === 'number' ? k.value : k.value, delta: k.delta };
      }
      return k;
    });
  }, [status]);

  const addEvent = useCallback((level: 'info' | 'warn' | 'success' | 'error', message: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setEvents((prev) => [{ id: `e-${Date.now()}`, level, time, message }, ...prev].slice(0, 20));
  }, []);

  const handleStart = useCallback(() => {
    if (status === 'running') {
      message.warning('仿真已在运行中');
      return;
    }
    setStatus('running');
    setRobots((rs) => rs.map((r) => ({ ...r, state: 'moving' as const })));
    addEvent('success', '仿真已启动');
    controlMutation.mutate({ action: 'start' });
    message.success('仿真已启动');
  }, [status, addEvent, message, controlMutation]);

  const handlePause = useCallback(() => {
    if (status !== 'running') {
      message.warning('仿真未运行');
      return;
    }
    setStatus('paused');
    setRobots((rs) => rs.map((r) => ({ ...r, state: 'idle' as const })));
    addEvent('warn', '仿真已暂停');
    controlMutation.mutate({ action: 'pause' });
    message.info('仿真已暂停');
  }, [status, addEvent, message, controlMutation]);

  const handleStop = useCallback(() => {
    setStatus('idle');
    setSimTime(0);
    setRobots((rs) => rs.map((r) => ({ ...r, state: 'idle' as const, progress: 0 })));
    addEvent('info', '仿真已停止并重置');
    controlMutation.mutate({ action: 'stop' });
    message.info('仿真已重置');
  }, [addEvent, message, controlMutation]);

  const handleAnomalyClick = useCallback(() => {
    if (status !== 'running') {
      message.warning('请先启动仿真');
      return;
    }
    setShowAnomalyModal(true);
  }, [status, message]);

  const handleConfirmAnomaly = useCallback(() => {
    const anomaly = ANOMALY_TYPES.find((a) => a.key === pendingAnomaly);
    if (!anomaly) return;
    setStatus('injected');
    addEvent('warn', `已注入异常：${anomaly.label}（${anomaly.key}）`);
    setRobots((rs) => {
      const idx = Math.floor(Math.random() * rs.length);
      return rs.map((r, i) => i === idx ? { ...r, state: 'idle' as const } : r);
    });
    setShowAnomalyModal(false);
    injectMutation.mutate({ type: pendingAnomaly });
    message.success(`已注入异常：${anomaly.label}`);
    setTimeout(() => setStatus('running'), 1500);
  }, [pendingAnomaly, addEvent, message, injectMutation]);

  // tab 隐藏/显示时重置时间参考点，避免大跳变
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastTickRef.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Canvas 渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let lastTime = performance.now();
    lastTickRef.current = lastTime;
    const draw = (now: number) => {
      // 防止 tab 隐藏后回到前台导致的负 dt / 跳变
      const rawDt = now - lastTime;
      lastTime = now;
      lastTickRef.current = now;
      const dt = safeDeltaSeconds(rawDt, speed);
      if (status === 'running' && dt > 0) {
        setSimTime((t) => Math.max(0, t + dt));
        setRobots((rs) =>
          rs.map((r) => {
            if (r.state !== 'moving') return r;
            return { ...r, progress: (r.progress + r.speed * speed) % 1 };
          }),
        );
      }

      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, w, h);

      // 背景
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, w, h);

      // 网格
      ctx.strokeStyle = 'rgba(11, 23, 51, 0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 24) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
      }
      for (let j = 0; j < h; j += 24) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(w, j);
        ctx.stroke();
      }

      // 仓库外墙
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, w - 40, h - 80);

      // 货架区（A/B/C/D）
      const zones = [
        { x: 0.10, y: 0.10, w: 0.34, h: 0.20, color: 'rgba(59,130,246,0.10)', label: 'A 区', stroke: '#3b82f6' },
        { x: 0.56, y: 0.10, w: 0.34, h: 0.20, color: 'rgba(34,197,94,0.10)', label: 'B 区', stroke: '#22c55e' },
        { x: 0.10, y: 0.55, w: 0.34, h: 0.20, color: 'rgba(245,158,11,0.10)', label: 'C 区', stroke: '#f59e0b' },
        { x: 0.56, y: 0.55, w: 0.34, h: 0.20, color: 'rgba(168,85,247,0.10)', label: 'D 区', stroke: '#a855f7' },
      ];
      zones.forEach((z) => {
        ctx.fillStyle = z.color;
        ctx.fillRect(z.x * w, z.y * h, z.w * w, z.h * h);
        ctx.strokeStyle = z.stroke + '60';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(z.x * w, z.y * h, z.w * w, z.h * h);

        // 货架纹理：每个区画 3x2 货架
        const cols = 3;
        const rows = 2;
        const padding = 6;
        const shelfW = (z.w * w - padding * (cols + 1)) / cols;
        const shelfH = (z.h * h - padding * (rows + 1)) / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const sx = z.x * w + padding + c * (shelfW + padding);
            const sy = z.y * h + padding + r * (shelfH + padding);
            ctx.fillStyle = z.stroke + '30';
            ctx.fillRect(sx, sy, shelfW, shelfH);
            ctx.strokeStyle = z.stroke + '80';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, shelfW, shelfH);
            // 货架横层
            ctx.strokeStyle = z.stroke + '40';
            for (let ly = 1; ly < 4; ly++) {
              ctx.beginPath();
              ctx.moveTo(sx, sy + (shelfH * ly) / 4);
              ctx.lineTo(sx + shelfW, sy + (shelfH * ly) / 4);
              ctx.stroke();
            }
          }
        }

        // 区域标签
        ctx.fillStyle = z.stroke;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(z.label, z.x * w + 8, z.y * h + 18);
      });

      // 拥堵热区
      const cong = [
        { x: 0.40, y: 0.30, r: 26, color: 'rgba(239, 68, 68, 0.25)' },
        { x: 0.62, y: 0.65, r: 22, color: 'rgba(239, 68, 68, 0.20)' },
      ];
      cong.forEach((c) => {
        const grad = ctx.createRadialGradient(c.x * w, c.y * h, 0, c.x * w, c.y * h, c.r);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x * w, c.y * h, c.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // 路径
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      robots.forEach((r) => {
        ctx.beginPath();
        r.path.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt[0] * w, pt[1] * h);
          else ctx.lineTo(pt[0] * w, pt[1] * h);
        });
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 工作站 / 出入口
      const stations = [
        { x: 0.46, y: 0.05, color: '#f59e0b', label: '拣选', icon: '📦' },
        { x: 0.52, y: 0.05, color: '#f59e0b', label: '拣选', icon: '📦' },
        { x: 0.46, y: 0.95, color: '#10b981', label: '充电', icon: '⚡' },
        { x: 0.52, y: 0.95, color: '#10b981', label: '充电', icon: '⚡' },
      ];
      stations.forEach((s) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(s.x * w - 10, s.y * h - 10, 20, 20);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x * w - 10, s.y * h - 10, 20, 20);
        ctx.fillStyle = s.color;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.icon, s.x * w, s.y * h + 4);
        ctx.textAlign = 'start';
      });

      // 出入口标签
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText('出库口 01', 0.04 * w, 0.05 * h);
      ctx.fillText('出库口 02', 0.20 * w, 0.05 * h);
      ctx.fillText('入库口 01', 0.78 * w, 0.05 * h);
      ctx.fillText('入库口 02', 0.92 * w, 0.05 * h);

      // AGV
      robots.forEach((r) => {
        const segCount = r.path.length - 1;
        const segIdx = Math.floor(r.progress * segCount);
        const segProg = r.progress * segCount - segIdx;
        const p1 = r.path[segIdx];
        const p2 = r.path[(segIdx + 1) % r.path.length];
        const x = (p1[0] + (p2[0] - p1[0]) * segProg) * w;
        const y = (p1[1] + (p2[1] - p1[1]) * segProg) * h;

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(x, y + 6, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // AGV 车身（圆角矩形）
        const isMoving = r.state === 'moving';
        ctx.fillStyle = r.color;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x - 9, y - 7, 18, 14, 3);
        } else {
          ctx.rect(x - 9, y - 7, 18, 14);
        }
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 方向指示
        if (isMoving) {
          const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(5, 0);
          ctx.lineTo(-2, -3);
          ctx.lineTo(-2, 3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // 标签
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(r.id, x + 11, y - 4);
        // 状态小点
        ctx.fillStyle = r.state === 'moving' ? '#22c55e' : r.state === 'idle' ? '#94a3b8' : r.state === 'charging' ? '#10b981' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(x + 11, y + 4, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [robots, speed, status]);

  const simTimeStr = useMemo(() => formatSimTime(simTime), [simTime]);

  return (
    <div className="simulation-page">
      <div className="kpi-row">
        {kpis.map((k) => (
          <KpiCard key={k.title} data={k} />
        ))}
      </div>

      <div className="sim-grid">
        <div className="sim-main">
          <SectionCard
            title="仿真视图（实时）"
            extra={
              <Space>
                <Tag color={status === 'running' ? 'success' : status === 'paused' ? 'warning' : status === 'injected' ? 'error' : 'default'}>
                  {status === 'running' ? '运行中' : status === 'paused' ? '已暂停' : status === 'injected' ? '异常注入' : '空闲'}
                </Tag>
                <span className="num-font" style={{ color: '#6b7280', fontSize: 12 }}>{simTimeStr}</span>
                <Button type="text" icon={<FullscreenOutlined />} onClick={() => setIsFullscreen((v) => !v)}>
                  {isFullscreen ? '退出全屏' : '全屏'}
                </Button>
              </Space>
            }
            bodyHeight={status === 'injected' ? 520 : 520}
            className="sim-canvas-card"
          >
            <div className="canvas-with-legend">
              <div className="canvas-legend">
                <div className="legend-title">图例</div>
                {simulationLegend.map((l) => (
                  <div key={l.key} className="legend-row">
                    <span
                      className="legend-marker"
                      style={{
                        background: l.color,
                        ...(l.dashed ? { background: 'transparent', border: `1.5px dashed ${l.color}` } : {}),
                      }}
                    />
                    <span className="legend-label">{l.label}</span>
                  </div>
                ))}
              </div>
              <div className="canvas-area">
                <canvas ref={canvasRef} className="sim-canvas" />
                <div className="canvas-toolbar">
                  <Button size="small" icon={<PlusOutlined />} title="放大" />
                  <Button size="small" icon={<AimOutlined />} title="定位" />
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="sim-control-bar">
            <Space>
              {status !== 'running' ? (
                <Button type="primary" icon={<CaretRightOutlined />} onClick={handleStart}>
                  启动仿真
                </Button>
              ) : (
                <Button type="primary" icon={<PauseOutlined />} onClick={handlePause}>
                  暂停仿真
                </Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={handleStop}>
                重置
              </Button>
              <Button danger icon={<AlertOutlined />} onClick={handleAnomalyClick}>
                注入异常
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={() => message.info('进化引擎已调度，请稍候')}>
                运行进化
              </Button>
            </Space>
            <div className="sim-speed">
              <span className="speed-label">仿真速度</span>
              <Select
                value={speed}
                onChange={setSpeed}
                style={{ width: 90 }}
                options={[
                  { value: 0.5, label: '0.5x' },
                  { value: 1, label: '1.0x' },
                  { value: 2, label: '2.0x' },
                  { value: 4, label: '4.0x' },
                ]}
              />
            </div>
          </div>

          <div className="sim-info-grid">
            <SectionCard title="实时任务日志" extra={<a onClick={() => setEvents([])}>清空</a>} bodyHeight={220}>
              <div className="event-list">
                {eventsLoading && events.length === 0 ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : events.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0' }}>暂无日志，启动仿真后开始记录</div>
                ) : (
                  events.map((e) => (
                    <div key={e.id} className="event-row">
                      <span className="event-time num-font">{e.time}</span>
                      <span className="event-level">{levelIcon[e.level]}</span>
                      <span className="event-msg">{e.message}</span>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard title="仿真信息" bodyHeight={220}>
              <div className="info-table">
                <div className="info-row">
                  <span className="info-label">场景名称</span>
                  <span className="info-val">{consoleSceneInfo.sceneName}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">AGV 在线</span>
                  <span className="info-val num-font">{robots.filter((r) => r.state !== 'idle').length} / {robots.length}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">仿真时长</span>
                  <span className="info-val num-font">{simTimeStr}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">开始时间</span>
                  <span className="info-val num-font">{consoleSceneInfo.startTime}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">随机种子</span>
                  <span className="info-val num-font">{run?.randomSeed ?? '—'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">当前版本</span>
                  <span className="info-val">{run?.version ?? '—'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">当前策略</span>
                  <span className="info-val">{run?.strategy ?? '—'}</span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="sim-aside">
          <SectionCard title="多智能体状态" bodyHeight={920}>
            <div className="agent-list">
              {agentsLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : agents.map((a) => {
                const aRobot = robots.find((r) => a.role === 'dispatch' ? r.id === 'A-067' : a.role === 'navigation' ? r.id === 'A-118' : a.role === 'operation' ? r.id === 'A-025' : null);
                return (
                <div key={a.id} className="agent-card">
                  <div className="agent-header">
                    <div className="agent-name">
                      <span className={`status-dot ${status === 'running' ? 'running' : 'info'}`} />
                      <span className="name-text">{a.name}</span>
                      {a.isPrimary && <Tag color="blue" className="primary-tag">主控</Tag>}
                    </div>
                    <Tag color={status === 'running' ? 'success' : 'default'}>
                      {status === 'running' ? '运行中' : '空闲'}
                    </Tag>
                  </div>
                  <div className="agent-stats">
                    {a.details.map((d) => (
                      <div key={d.label} className="agent-stat">
                        <div className="stat-label">{d.label}</div>
                        <div className="stat-value num-font">
                          {d.value}
                          {d.unit && <span className="stat-unit"> {d.unit}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="agent-sparkline">
                    <svg viewBox="0 0 200 40" width="100%" height="40">
                      <polyline
                        fill="none"
                        stroke={status === 'running' ? '#2b6fff' : '#94a3b8'}
                        strokeWidth="1.5"
                        points={a.sparkline
                          .map((v, i) => `${(i / (a.sparkline.length - 1)) * 200},${40 - (v / Math.max(...a.sparkline)) * 36}`)
                          .join(' ')}
                      />
                    </svg>
                  </div>
                  {aRobot && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      绑定 AGV：<b style={{ color: aRobot.color }}>{aRobot.id}</b> · 状态：<b>{aRobot.state}</b>
                    </div>
                  )}
                </div>
              )})}
            </div>
          </SectionCard>
        </div>
      </div>

      <Modal
        title="注入异常"
        open={showAnomalyModal}
        onCancel={() => setShowAnomalyModal(false)}
        onOk={handleConfirmAnomaly}
        okText="确认注入"
        cancelText="取消"
      >
        <div style={{ padding: '12px 0' }}>
          <div style={{ marginBottom: 8, color: '#6b7280', fontSize: 13 }}>选择异常类型：</div>
          <Select
            value={pendingAnomaly}
            onChange={setPendingAnomaly}
            style={{ width: '100%' }}
            options={ANOMALY_TYPES.map((a) => (
              { value: a.key, label: <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: a.color, marginRight: 8 }} />{a.label}</span> }
            ))}
          />
          <div style={{ marginTop: 12, padding: 10, background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
            ⚠ 异常注入后将在日志中记录，AGV 状态变化可在右侧智能体面板查看。
          </div>
        </div>
      </Modal>
    </div>
  );
}
