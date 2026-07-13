import { Card, type CardProps } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import type { KpiCardData } from '@ican/contracts';
import './KpiCard.css';

interface KpiCardProps extends Omit<CardProps, 'title'> {
  data: KpiCardData;
  showDelta?: boolean;
  size?: 'default' | 'small';
}

export function KpiCard({ data, showDelta = true, size = 'default', ...rest }: KpiCardProps) {
  const isUp = data.trend === 'up';
  const isDown = data.trend === 'down';
  const deltaColor = !data.delta
    ? '#9ca3af'
    : data.trend === 'flat'
      ? '#9ca3af'
      : data.trend === 'up'
        ? '#22c55e'
        : '#ef4444';

  return (
    <Card className={`kpi-card ${size === 'small' ? 'kpi-card-sm' : ''}`} {...rest}>
      <div className="kpi-title">{data.title}</div>
      <div className="kpi-value-row">
        <span className="kpi-value num-font">{data.value}</span>
        {data.unit && <span className="kpi-unit">{data.unit}</span>}
        {data.iconColor && (
          <span className="kpi-icon" style={{ color: data.iconColor }}>
            <span className="kpi-icon-bg" style={{ background: `${data.iconColor}18` }} />
          </span>
        )}
      </div>
      {showDelta && data.delta !== undefined && (
        <div className="kpi-delta" style={{ color: deltaColor }}>
          {isUp && <ArrowUpOutlined />}
          {isDown && <ArrowDownOutlined />}
          {!isUp && !isDown && <MinusOutlined />}
          <span className="num-font">{Math.abs(data.delta)}%</span>
          {data.deltaLabel && <span className="kpi-delta-label">{data.deltaLabel}</span>}
        </div>
      )}
    </Card>
  );
}
