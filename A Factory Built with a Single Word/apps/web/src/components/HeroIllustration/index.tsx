/**
 * 高保真 SVG 工厂/仓库插画
 * 用于 Hero、模板卡、案例卡等场景
 * 特点：分层结构、丰富细节、动画点缀
 */

interface HeroIllustrationProps {
  variant?: 'warehouse' | 'ecom' | 'coldchain' | '3c' | 'medical' | 'agv' | 'arm';
  height?: number;
  className?: string;
}

export function HeroIllustration({ variant = 'warehouse', height = 240, className }: HeroIllustrationProps) {
  if (variant === 'agv') return <AgvIllustration height={height} className={className} />;
  if (variant === 'arm') return <ArmIllustration height={height} className={className} />;
  return <WarehouseIllustration variant={variant} height={height} className={className} />;
}

function WarehouseIllustration({ variant, height, className }: { variant: string; height: number; className?: string }) {
  const palettes: Record<string, { wall: string; wallStroke: string; floor: string; shelfA: string; shelfB: string; shelfC: string; shelfD: string; agv: string; agv2: string; path: string; accent: string }> = {
    warehouse: { wall: '#e0e7ff', wallStroke: '#94a3b8', floor: '#f1f5f9', shelfA: '#3b82f6', shelfB: '#22c55e', shelfC: '#f59e0b', shelfD: '#a855f7', agv: '#06b6d4', agv2: '#ec4899', path: '#3b82f6', accent: '#0b1733' },
    ecom: { wall: '#dbeafe', wallStroke: '#60a5fa', floor: '#eff6ff', shelfA: '#3b82f6', shelfB: '#22c55e', shelfC: '#f59e0b', shelfD: '#a855f7', agv: '#06b6d4', agv2: '#ec4899', path: '#3b82f6', accent: '#0b1733' },
    coldchain: { wall: '#cffafe', wallStroke: '#06b6d4', floor: '#ecfeff', shelfA: '#06b6d4', shelfB: '#0891b2', shelfC: '#0e7490', shelfD: '#155e75', agv: '#22d3ee', agv2: '#67e8f9', path: '#0891b2', accent: '#0c4a6e' },
    '3c': { wall: '#ede9fe', wallStroke: '#8b5cf6', floor: '#f5f3ff', shelfA: '#8b5cf6', shelfB: '#a78bfa', shelfC: '#c4b5fd', shelfD: '#ddd6fe', agv: '#7c3aed', agv2: '#a78bfa', path: '#8b5cf6', accent: '#4c1d95' },
    medical: { wall: '#dcfce7', wallStroke: '#22c55e', floor: '#f0fdf4', shelfA: '#22c55e', shelfB: '#10b981', shelfC: '#14b8a6', shelfD: '#06b6d4', agv: '#16a34a', agv2: '#34d399', path: '#10b981', accent: '#064e3b' },
  };
  const p = palettes[variant] ?? palettes.warehouse;

  return (
    <svg viewBox="0 0 480 240" height={height} className={className} preserveAspectRatio="xMidYMid meet" style={{ width: '100%' }}>
      {/* 背景 */}
      <defs>
        <linearGradient id={`grad-${variant}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.floor} />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id={`grad-${variant}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.wall} stopOpacity="0.6" />
          <stop offset="100%" stopColor={p.wall} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect width="480" height="240" fill={`url(#grad-${variant}-floor)`} />
      {/* 仓库外墙 */}
      <rect x="40" y="40" width="400" height="170" fill={`url(#grad-${variant}-wall)`} stroke={p.wallStroke} strokeWidth="1.5" rx="4" />
      {/* 屋顶 */}
      <path d="M 40 40 L 240 16 L 440 40 Z" fill={p.wallStroke} opacity="0.3" />
      {/* 入口标签 */}
      <text x="50" y="32" fontSize="9" fill={p.accent} opacity="0.6">出库口 01</text>
      <text x="380" y="32" fontSize="9" fill={p.accent} opacity="0.6">入库口 01</text>
      {/* 4 区货架 */}
      {[
        { x: 60, y: 60, color: p.shelfA, label: 'A' },
        { x: 280, y: 60, color: p.shelfB, label: 'B' },
        { x: 60, y: 140, color: p.shelfC, label: 'C' },
        { x: 280, y: 140, color: p.shelfD, label: 'D' },
      ].map((z) => (
        <g key={z.label}>
          <rect x={z.x} y={z.y} width="140" height="60" fill={z.color} opacity="0.18" stroke={z.color} strokeWidth="1" rx="3" />
          <text x={z.x + 6} y={z.y + 14} fontSize="11" fontWeight="700" fill={z.color}>{z.label} 区</text>
          {/* 货架纹理 2 行 4 列 */}
          {Array.from({ length: 8 }).map((_, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            return (
              <g key={i}>
                <rect
                  x={z.x + 10 + col * 32}
                  y={z.y + 22 + row * 18}
                  width="28"
                  height="14"
                  fill={z.color}
                  opacity="0.5"
                  rx="1"
                />
                {/* 货架横层 */}
                <line
                  x1={z.x + 10 + col * 32}
                  y1={z.y + 26 + row * 18}
                  x2={z.x + 10 + col * 32 + 28}
                  y2={z.y + 26 + row * 18}
                  stroke="#fff"
                  strokeWidth="0.5"
                />
                <line
                  x1={z.x + 10 + col * 32}
                  y1={z.y + 32 + row * 18}
                  x2={z.x + 10 + col * 32 + 28}
                  y2={z.y + 32 + row * 18}
                  stroke="#fff"
                  strokeWidth="0.5"
                />
              </g>
            );
          })}
        </g>
      ))}
      {/* 路径 */}
      <path
        d="M 80 220 Q 200 100 240 120 T 400 100 L 400 50"
        fill="none"
        stroke={p.path}
        strokeWidth="2"
        strokeDasharray="4,3"
        opacity="0.6"
      />
      {/* AGV 1 */}
      <g transform="translate(200, 100)">
        <ellipse cx="0" cy="6" rx="10" ry="3" fill="rgba(0,0,0,0.2)" />
        <rect x="-8" y="-6" width="16" height="12" rx="2" fill={p.agv} stroke="#fff" strokeWidth="1" />
        <circle cx="-5" cy="6" r="2" fill={p.agv} />
        <circle cx="5" cy="6" r="2" fill={p.agv} />
        <text x="0" y="3" fontSize="6" fill="#fff" textAnchor="middle" fontWeight="700">A</text>
      </g>
      {/* AGV 2 */}
      <g transform="translate(320, 130)">
        <ellipse cx="0" cy="6" rx="10" ry="3" fill="rgba(0,0,0,0.2)" />
        <rect x="-8" y="-6" width="16" height="12" rx="2" fill={p.agv2} stroke="#fff" strokeWidth="1" />
        <circle cx="-5" cy="6" r="2" fill={p.agv2} />
        <circle cx="5" cy="6" r="2" fill={p.agv2} />
        <text x="0" y="3" fontSize="6" fill="#fff" textAnchor="middle" fontWeight="700">B</text>
      </g>
      {/* 充电桩 */}
      <g transform="translate(230, 215)">
        <rect x="-6" y="-10" width="12" height="14" fill="#10b981" stroke="#fff" strokeWidth="1" rx="1" />
        <text x="0" y="20" fontSize="7" fill="#0b1733" textAnchor="middle">⚡ 充电</text>
      </g>
      {/* 工作站 */}
      <g transform="translate(380, 215)">
        <rect x="-10" y="-6" width="20" height="12" fill="#f59e0b" stroke="#fff" strokeWidth="1" rx="2" />
        <text x="0" y="20" fontSize="7" fill="#0b1733" textAnchor="middle">📦 拣选</text>
      </g>
    </svg>
  );
}

function AgvIllustration({ height, className }: { height: number; className?: string }) {
  return (
    <svg viewBox="0 0 240 240" height={height} className={className} preserveAspectRatio="xMidYMid meet" style={{ width: '100%' }}>
      <defs>
        <linearGradient id="grad-agv-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#bfdbfe" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" fill="url(#grad-agv-bg)" rx="12" />
      {/* 地面网格 */}
      <g opacity="0.2">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 24} x2="240" y2={i * 24} stroke="#3b82f6" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 24} y1="0" x2={i * 24} y2="240" stroke="#3b82f6" strokeWidth="0.5" />
        ))}
      </g>
      {/* AGV 大图 */}
      <g transform="translate(120, 120)">
        <ellipse cx="0" cy="40" rx="50" ry="10" fill="rgba(0,0,0,0.15)" />
        <rect x="-40" y="-25" width="80" height="50" rx="8" fill="#06b6d4" stroke="#fff" strokeWidth="2" />
        <rect x="-30" y="-20" width="60" height="20" rx="3" fill="#0891b2" />
        <circle cx="-25" cy="25" r="8" fill="#1e293b" />
        <circle cx="25" cy="25" r="8" fill="#1e293b" />
        <circle cx="-25" cy="25" r="3" fill="#94a3b8" />
        <circle cx="25" cy="25" r="3" fill="#94a3b8" />
        {/* 方向灯 */}
        <circle cx="-40" cy="0" r="3" fill="#22c55e" />
        <circle cx="40" cy="0" r="3" fill="#ef4444" />
        {/* 顶部传感器 */}
        <rect x="-8" y="-32" width="16" height="6" fill="#3b82f6" />
        <text x="0" y="55" fontSize="14" fontWeight="700" textAnchor="middle" fill="#0b1733">AGV</text>
        <text x="0" y="72" fontSize="10" textAnchor="middle" fill="#6b7280">智能搬运机器人</text>
      </g>
    </svg>
  );
}

function ArmIllustration({ height, className }: { height: number; className?: string }) {
  return (
    <svg viewBox="0 0 240 240" height={height} className={className} preserveAspectRatio="xMidYMid meet" style={{ width: '100%' }}>
      <defs>
        <linearGradient id="grad-arm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ede9fe" />
          <stop offset="100%" stopColor="#ddd6fe" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" fill="url(#grad-arm-bg)" rx="12" />
      <g opacity="0.2">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 24} x2="240" y2={i * 24} stroke="#8b5cf6" strokeWidth="0.5" />
        ))}
      </g>
      {/* 机械臂大图 */}
      <g transform="translate(120, 130)">
        {/* 基座 */}
        <rect x="-30" y="40" width="60" height="20" fill="#475569" rx="3" />
        <rect x="-20" y="20" width="40" height="22" fill="#64748b" rx="2" />
        {/* 第一臂 */}
        <line x1="0" y1="20" x2="-30" y2="-30" stroke="#a855f7" strokeWidth="10" strokeLinecap="round" />
        <circle cx="0" cy="20" r="8" fill="#7e22ce" />
        {/* 关节 */}
        <circle cx="-30" cy="-30" r="8" fill="#7e22ce" />
        {/* 第二臂 */}
        <line x1="-30" y1="-30" x2="40" y2="-50" stroke="#a855f7" strokeWidth="10" strokeLinecap="round" />
        <circle cx="-30" cy="-30" r="8" fill="#7e22ce" />
        {/* 末端执行器 */}
        <g transform="translate(40, -50)">
          <rect x="-6" y="-4" width="12" height="20" fill="#475569" rx="2" />
          <path d="M -8 16 L 8 16 L 6 22 L -6 22 Z" fill="#1e293b" />
          <circle cx="0" cy="0" r="3" fill="#22c55e" />
        </g>
        <text x="0" y="80" fontSize="14" fontWeight="700" textAnchor="middle" fill="#0b1733">机械臂</text>
        <text x="0" y="98" fontSize="10" textAnchor="middle" fill="#6b7280">6 轴 · 智能拣选</text>
      </g>
    </svg>
  );
}
