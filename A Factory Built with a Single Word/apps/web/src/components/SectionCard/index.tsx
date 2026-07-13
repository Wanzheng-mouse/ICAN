import { Card, type CardProps } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import './SectionCard.css';

interface SectionCardProps extends CardProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  tooltip?: string;
  bordered?: boolean;
  bodyHeight?: number | string;
}

export function SectionCard({
  title,
  extra,
  tooltip,
  bordered = true,
  bodyHeight,
  className = '',
  children,
  ...rest
}: SectionCardProps) {
  return (
    <Card
      className={`section-card-component ${className}`}
      title={
        title ? (
          <div className="section-card-title">
            <span className="title-text">{title}</span>
            {tooltip && (
              <InfoCircleOutlined
                className="title-tooltip"
                title={tooltip}
                style={{ color: '#9ca3af', fontSize: 13, marginLeft: 6 }}
              />
            )}
          </div>
        ) : null
      }
      extra={extra}
      variant={bordered ? 'outlined' : 'borderless'}
      {...rest}
    >
      {bodyHeight ? (
        <div className="section-card-body" style={{ height: bodyHeight, overflow: 'auto' }}>
          {children}
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
