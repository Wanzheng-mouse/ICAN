/**
 * 高保真 SVG 工厂/仓库插画
 * 用于 Hero、模板卡、案例卡等场景
 * 特点：分层结构、丰富细节、动画点缀
 */

interface HeroIllustrationProps {
  variant?: 'warehouse' | 'ecom' | 'coldchain' | '3c' | 'medical' | 'agv' | 'arm' | 'isometric';
  height?: number;
  className?: string;
}

export function HeroIllustration({ variant = 'warehouse', height = 240, className }: HeroIllustrationProps) {
  if (variant === 'agv') return <AgvIllustration height={height} className={className} />;
  if (variant === 'arm') return <ArmIllustration height={height} className={className} />;
  if (variant === 'isometric') return <IsometricWarehouseIllustration height={height} className={className} />;
  return <WarehouseIllustration variant={variant} height={height} className={className} />;
}

/**
 * Hero 区专用的 3D 等距视角仓库插画 —— 对齐 Front-images/image01：
 * - 等距投影（30° 倾角）的工厂车间
 * - 高密度货架（带货物）
 * - AGV + 机械臂 + 充电桩
 * - 地面网格 + 顶灯 + 数据流粒子
 */
function IsometricWarehouseIllustration({ height, className }: { height: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 640 360"
      height={height}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%' }}
    >
      <defs>
        {/* 背景渐变（冷色工厂天空） */}
        <linearGradient id="iso-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#eff6ff" />
        </linearGradient>
        {/* 地面渐变 */}
        <linearGradient id="iso-floor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef2f7" />
          <stop offset="100%" stopColor="#dbe3ec" />
        </linearGradient>
        {/* 货架顶面 */}
        <linearGradient id="iso-shelf-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7aa2ec" />
          <stop offset="100%" stopColor="#5683d4" />
        </linearGradient>
        <linearGradient id="iso-shelf-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5683d4" />
          <stop offset="100%" stopColor="#3b6bc7" />
        </linearGradient>
        <linearGradient id="iso-shelf-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b6bc7" />
          <stop offset="100%" stopColor="#2855a6" />
        </linearGradient>
        {/* AGV 渐变 */}
        <linearGradient id="iso-agv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        {/* 机械臂渐变 */}
        <linearGradient id="iso-arm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      {/* 背景 */}
      <rect width="640" height="360" fill="url(#iso-sky)" />
      {/* 远端仓库墙体（透视感） */}
      <polygon points="60,80 320,40 580,80 320,120" fill="#c7d3e5" opacity="0.7" />
      <polygon points="60,80 60,260 320,300 320,120" fill="#9bb1cd" opacity="0.55" />
      <polygon points="580,80 580,260 320,300 320,120" fill="#7b91b0" opacity="0.55" />
      {/* 顶部灯带 */}
      <rect x="120" y="50" width="200" height="6" fill="#fbbf24" opacity="0.85" rx="2" />
      <rect x="340" y="50" width="180" height="6" fill="#fbbf24" opacity="0.7" rx="2" />
      <circle cx="220" cy="55" r="6" fill="#fde68a" opacity="0.9" />
      <circle cx="420" cy="55" r="6" fill="#fde68a" opacity="0.8" />

      {/* 地面（等距） */}
      <polygon
        points="60,180 580,180 580,310 60,310"
        fill="url(#iso-floor)"
      />
      {/* 地面网格：横向 */}
      <g stroke="#b0bfd0" strokeWidth="0.6" opacity="0.55">
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`gf${i}`} x1={80 + i * 100} y1={185 + i * 22} x2={100 + i * 100} y2={305} />
        ))}
      </g>
      {/* 地面网格：纵向 */}
      <g stroke="#b0bfd0" strokeWidth="0.6" opacity="0.45">
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`gv${i}`} x1={120 + i * 110} y1={210} x2={320 - i * 50} y2={305} />
        ))}
      </g>
      {/* 路径箭头（运行轨道） */}
      <path
        d="M 110 270 L 230 250 L 360 255 L 470 240"
        stroke="#3b82f6"
        strokeWidth="2.5"
        strokeDasharray="6 5"
        fill="none"
        opacity="0.75"
      />
      <polygon points="470,240 462,235 462,245" fill="#3b82f6" opacity="0.85" />

      {/* === 立体货架 1（左前） === */}
      {(() => {
        const baseX = 140,
          baseY = 240,
          w = 110,
          d = 38,
          h = 130;
        // 顶
        return (
          <g>
            <polygon
              points={`${baseX},${baseY} ${baseX + w},${baseY - d / 2} ${baseX + w + d},${baseY + d / 2 - d} ${baseX + d},${baseY + d / 2}`}
              fill="url(#iso-shelf-top)"
              stroke="#2855a6"
              strokeWidth="0.6"
            />
            {/* 实际上方 */}
            <polygon
              points={`${baseX + w},${baseY - d / 2} ${baseX + w + d},${baseY + d / 2 - d} ${baseX + w + d},${baseY + d / 2 - d + h} ${baseX + w},${baseY - d / 2 + h}`}
              fill="url(#iso-shelf-right)"
            />
            {/* 左正面 */}
            <polygon
              points={`${baseX},${baseY} ${baseX + d},${baseY + d / 2} ${baseX + d},${baseY + d / 2 + h} ${baseX},${baseY + h}`}
              fill="url(#iso-shelf-left)"
            />
            {/* 货位层（5 层） */}
            {Array.from({ length: 5 }).map((_, i) => {
              const yOff = (i + 1) * (h / 6);
              return (
                <g key={`sh1-${i}`}>
                  <rect
                    x={baseX + 6}
                    y={baseY + yOff - 4}
                    width={d * 0.85}
                    height={6}
                    fill="#1e3a8a"
                    opacity="0.35"
                  />
                  {Array.from({ length: 3 }).map((__, j) => (
                    <rect
                      key={j}
                      x={baseX + 10 + j * 10}
                      y={baseY + yOff - 3}
                      width={6}
                      height={4}
                      fill="#fde68a"
                      opacity="0.85"
                    />
                  ))}
                </g>
              );
            })}
            {/* 标签 */}
            <text x={baseX + d * 0.5} y={baseY - d * 0.1} fontSize="9" fill="#fff" textAnchor="middle" opacity="0.8">A 区货架</text>
          </g>
        );
      })()}

      {/* === 立体货架 2（中） === */}
      {(() => {
        const baseX = 320,
          baseY = 230,
          w = 110,
          d = 38,
          h = 145;
        return (
          <g>
            <polygon
              points={`${baseX},${baseY} ${baseX + w},${baseY - d / 2} ${baseX + w + d},${baseY + d / 2 - d} ${baseX + d},${baseY + d / 2}`}
              fill="url(#iso-shelf-top)"
              stroke="#2855a6"
              strokeWidth="0.6"
            />
            <polygon
              points={`${baseX + w},${baseY - d / 2} ${baseX + w + d},${baseY + d / 2 - d} ${baseX + w + d},${baseY + d / 2 - d + h} ${baseX + w},${baseY - d / 2 + h}`}
              fill="url(#iso-shelf-right)"
            />
            <polygon
              points={`${baseX},${baseY} ${baseX + d},${baseY + d / 2} ${baseX + d},${baseY + d / 2 + h} ${baseX},${baseY + h}`}
              fill="url(#iso-shelf-left)"
            />
            {Array.from({ length: 6 }).map((_, i) => {
              const yOff = (i + 1) * (h / 7);
              return (
                <g key={`sh2-${i}`}>
                  <rect
                    x={baseX + 6}
                    y={baseY + yOff - 4}
                    width={d * 0.85}
                    height={6}
                    fill="#1e3a8a"
                    opacity="0.35"
                  />
                  {Array.from({ length: 3 }).map((__, j) => (
                    <rect
                      key={j}
                      x={baseX + 10 + j * 10}
                      y={baseY + yOff - 3}
                      width={6}
                      height={4}
                      fill="#fde68a"
                      opacity="0.85"
                    />
                  ))}
                </g>
              );
            })}
            <text x={baseX + d * 0.5} y={baseY - d * 0.1} fontSize="9" fill="#fff" textAnchor="middle" opacity="0.8">B 区货架</text>
          </g>
        );
      })()}

      {/* === AGV 1（左前移动中） === */}
      <g transform="translate(220, 270)">
        <ellipse cx="0" cy="14" rx="20" ry="3" fill="rgba(15,42,90,0.18)" />
        {/* 底盘（等距矩形） */}
        <polygon points="-18,-2 0,-12 22,-2 4,8" fill="url(#iso-agv)" stroke="#0e7490" strokeWidth="0.6" />
        <polygon points="-18,-2 -18,8 4,18 4,8" fill="#0e7490" />
        <polygon points="22,-2 22,8 4,18 4,8" fill="#155e75" />
        {/* 顶传感器 */}
        <rect x="-3" y="-18" width="6" height="6" fill="#22d3ee" stroke="#0e7490" strokeWidth="0.5" />
        {/* 屏幕指示灯 */}
        <circle cx="-12" cy="3" r="2" fill="#fff" opacity="0.9" />
        <circle cx="14" cy="-2" r="2" fill="#fbbf24" />
      </g>
      {/* AGV 1 标签 */}
      <text x="225" y="298" fontSize="9" fill="#0e7490" opacity="0.85" textAnchor="middle">AGV-01</text>

      {/* === AGV 2（右侧搬运中） === */}
      <g transform="translate(450, 250)">
        <ellipse cx="0" cy="14" rx="20" ry="3" fill="rgba(15,42,90,0.18)" />
        <polygon points="-18,-2 0,-12 22,-2 4,8" fill="url(#iso-agv)" stroke="#0e7490" strokeWidth="0.6" />
        <polygon points="-18,-2 -18,8 4,18 4,8" fill="#0e7490" />
        <polygon points="22,-2 22,8 4,18 4,8" fill="#155e75" />
        <rect x="-3" y="-18" width="6" height="6" fill="#22d3ee" stroke="#0e7490" strokeWidth="0.5" />
        <circle cx="-12" cy="3" r="2" fill="#fff" opacity="0.9" />
        <circle cx="14" cy="-2" r="2" fill="#22c55e" />
      </g>
      <text x="455" y="278" fontSize="9" fill="#0e7490" opacity="0.85" textAnchor="middle">AGV-03</text>

      {/* === 机械臂（右后） === */}
      <g transform="translate(540, 220)">
        {/* 基座 */}
        <ellipse cx="0" cy="20" rx="14" ry="4" fill="rgba(15,42,90,0.18)" />
        <rect x="-10" y="6" width="20" height="14" fill="#475569" />
        <rect x="-14" y="-2" width="28" height="10" fill="url(#iso-arm)" rx="2" />
        {/* 第一臂 */}
        <line x1="-4" y1="-2" x2="-22" y2="-30" stroke="url(#iso-arm)" strokeWidth="8" strokeLinecap="round" />
        <circle cx="-4" cy="-2" r="4" fill="#6d28d9" />
        <circle cx="-22" cy="-30" r="4" fill="#6d28d9" />
        {/* 第二臂 */}
        <line x1="-22" y1="-30" x2="14" y2="-44" stroke="url(#iso-arm)" strokeWidth="8" strokeLinecap="round" />
        {/* 末端夹 */}
        <g transform="translate(14, -44)">
          <rect x="-3" y="-2" width="6" height="10" fill="#1f2937" />
          <path d="M -5 8 L 5 8 L 4 12 L -4 12 Z" fill="#0f172a" />
        </g>
        {/* 物料盒 */}
        <rect x="6" y="-58" width="16" height="14" fill="#fde68a" stroke="#a16207" strokeWidth="0.6" />
      </g>
      <text x="538" y="248" fontSize="9" fill="#7c3aed" opacity="0.85" textAnchor="middle">机械臂</text>

      {/* === 充电桩（左下角） === */}
      <g transform="translate(80, 280)">
        <rect x="-8" y="-22" width="16" height="22" fill="#10b981" stroke="#047857" strokeWidth="0.6" />
        <rect x="-6" y="-19" width="12" height="4" fill="#a7f3d0" />
        <circle cx="0" cy="-8" r="2" fill="#fff" />
        <text x="0" y="8" fontSize="9" fill="#047857" textAnchor="middle">⚡ 充电</text>
      </g>

      {/* === 数据流粒子 === */}
      <g opacity="0.7">
        <circle cx="170" cy="150" r="2" fill="#3b82f6">
          <animate attributeName="cy" values="150;170;150" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="450" cy="140" r="2" fill="#8b5cf6">
          <animate attributeName="cy" values="140;170;140" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="320" cy="130" r="1.5" fill="#22c55e">
          <animate attributeName="cy" values="130;160;130" dur="3.5s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* 整体柔光蒙版，让前景更亮 */}
      <rect width="640" height="360" fill="url(#iso-sky)" opacity="0.08" />
    </svg>
  );
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
