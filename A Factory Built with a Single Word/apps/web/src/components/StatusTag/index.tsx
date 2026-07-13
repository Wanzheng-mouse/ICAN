import { Tag } from 'antd';
import type { RiskLevel, TaskStatus, RunStatus } from '@ican/contracts';

const taskStatusMap: Record<TaskStatus, { color: string; text: string }> = {
  pending: { color: 'default', text: '待执行' },
  assigned: { color: 'blue', text: '已分配' },
  running: { color: 'processing', text: '进行中' },
  completed: { color: 'success', text: '已完成' },
  failed: { color: 'error', text: '失败' },
  abnormal: { color: 'warning', text: '异常' },
};

export function TaskStatusTag({ status }: { status: TaskStatus }) {
  const cfg = taskStatusMap[status];
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
}

const riskMap: Record<RiskLevel, { color: string; text: string }> = {
  high: { color: 'red', text: '高风险' },
  medium: { color: 'orange', text: '中风险' },
  low: { color: 'blue', text: '低风险' },
};

export function RiskTag({ level }: { level: RiskLevel }) {
  const cfg = riskMap[level];
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
}

const runStatusMap: Record<RunStatus, { color: string; text: string }> = {
  created: { color: 'default', text: '已创建' },
  running: { color: 'processing', text: '运行中' },
  paused: { color: 'warning', text: '已暂停' },
  finished: { color: 'success', text: '已结束' },
  failed: { color: 'error', text: '失败' },
};

export function RunStatusTag({ status }: { status: RunStatus }) {
  const cfg = runStatusMap[status];
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
}
