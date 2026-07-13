import { useMemo } from 'react';
import {
  CheckCircleFilled,
  ExclamationCircleFilled,
  FileTextOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { App, Button, InputNumber, Select, Tag } from 'antd';
import { Background, Controls, Handle, Position, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SectionCard, TaskStatusTag } from '@/components';
import {
  useOrchestrationAgents,
  useOrchestrationBranches,
  useOrchestrationFlowEdges,
  useOrchestrationFlowNodes,
  useOrchestrationGoal,
  useOrchestrationQueue,
  useOrchestrationStrategy,
} from '@/api/modules';
import './index.css';

const statusMap = {
  completed: { color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  running: { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  pending: { color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
  abnormal: { color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  monitoring: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
} as const;

const roleColors = {
  dispatch: '#3b82f6',
  navigation: '#06b6d4',
  operation: '#a855f7',
  energy: '#10b981',
  safety: '#f97316',
  evaluation: '#eab308',
  report: '#ec4899',
} as const;

function CustomNode({ data }: { data: any }) {
  const d = data as { label: string; index: number; status: keyof typeof statusMap; description: string };
  const s = statusMap[d.status];
  return (
    <div
      className="flow-custom-node"
      style={{
        background: s.bg,
        border: `1.5px solid ${s.border}`,
        color: data.status === 'pending' ? '#6b7280' : '#1f2937',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#d1d5db', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#d1d5db', width: 6, height: 6 }} />
      <div className="flow-node-header">
        <span className="flow-node-index" style={{ background: s.color, color: '#fff' }}>
          {d.index}
        </span>
        <span className="flow-node-label">{d.label}</span>
        {d.status === 'running' && <ThunderboltOutlined style={{ color: '#3b82f6', fontSize: 12 }} />}
        {d.status === 'abnormal' && <ExclamationCircleFilled style={{ color: '#ef4444', fontSize: 14 }} />}
      </div>
      <div className="flow-node-desc">{d.description}</div>
      <div className="flow-node-status" style={{ color: s.color }}>
        {d.status === 'completed' && '✓ 已完成'}
        {d.status === 'running' && '⟳ 进行中'}
        {d.status === 'pending' && '○ 待执行'}
        {d.status === 'abnormal' && '⚠ 监控中'}
      </div>
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

export default function Orchestration() {
  const { message } = App.useApp();

  // ===== 领域 API 接入 =====
  const { data: flowNodes } = useOrchestrationFlowNodes();
  const { data: flowEdges } = useOrchestrationFlowEdges();
  const { data: goal } = useOrchestrationGoal();
  const { data: branchesData } = useOrchestrationBranches();
  const { data: agentsData } = useOrchestrationAgents();
  const { data: queueData } = useOrchestrationQueue();
  const { data: strategy } = useOrchestrationStrategy();

  const initialNodes: any[] = useMemo(
    () =>
      (flowNodes ?? []).map((n) => ({
        id: n.id,
        type: 'custom',
        position: { x: n.x, y: n.y },
        data: { label: n.label, index: n.index, status: n.status, description: n.description },
      })),
    [flowNodes],
  );

  const initialEdges: any[] = useMemo(
    () =>
      (flowEdges ?? []).map((e) => ({
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        animated: e.isAbnormal,
        style: {
          stroke: e.isAbnormal ? '#ef4444' : '#94a3b8',
          strokeWidth: 1.5,
          strokeDasharray: e.dashed ? '5,4' : 'none',
        },
        type: 'smoothstep',
      })),
    [flowEdges],
  );

  const branches = branchesData ?? [];
  const agents = agentsData ?? [];
  const queue = queueData ?? [];

  return (
    <div className="orchestration-page">
      {/* Header */}
      <div className="orch-header">
        <div className="orch-header-left">
          <h1 className="orch-title">
            <a className="back-link">←</a> 任务编排 / 智能体协同
            <Tag color="success" className="running-tag">运行中</Tag>
          </h1>
          <p className="orch-subtitle">将自然语言需求转化为多智能体协同执行流程</p>
        </div>
        <div className="orch-header-right">
          <Button icon={<SaveOutlined />} onClick={() => message.success('已保存为模板（演示）')}>保存为模板</Button>
          <Button onClick={() => message.info('操作菜单（演示）')}>操作</Button>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => message.loading('正在启动多智能体协同...', 1.2).then(() => message.success('已启动'))}>启动执行</Button>
        </div>
      </div>

      <div className="orch-grid">
        {/* 左侧：任务目标 */}
        <div className="orch-left">
          <SectionCard
            title={
              <span>
                <span className="orch-icon">📋</span> 任务目标
              </span>
            }
          >
            <div className="goal-section">
              <div className="goal-label">用户需求（自然语言）</div>
               <div className="goal-text">{goal?.userRequirement ?? '—'}</div>
            </div>

            <div className="goal-section">
              <div className="goal-label">解析结果</div>
              <div className="parsed-list">
                <div className="parsed-row">
                  <CheckCircleFilled style={{ color: '#22c55e' }} />
                  <span className="parsed-label">核心目标</span>
                   <span className="parsed-val">{goal?.parsedResult.coreGoal ?? '—'}</span>
                </div>
                <div className="parsed-row">
                  <span className="parsed-icon" />
                  <span className="parsed-label">约束条件</span>
                  <div className="parsed-val">
                    {(goal?.parsedResult.constraints ?? []).map((c) => (
                      <div key={c}>· {c}</div>
                    ))}
                  </div>
                </div>
                <div className="parsed-row">
                  <span className="parsed-icon flag" style={{ background: '#ef4444' }} />
                  <span className="parsed-label">优先级</span>
                  <Tag color="red">{goal?.parsedResult.priority === 'high' ? '高' : '中'}</Tag>
                </div>
                <div className="parsed-row">
                  <span className="parsed-icon" style={{ background: '#3b82f6' }} />
                  <span className="parsed-label">预计完成时间</span>
                  <span className="parsed-val">{goal?.parsedResult.expectedFinish ?? '—'}</span>
                </div>
              </div>
            </div>

            <div className="goal-section">
              <div className="goal-label">上传文件 (2)</div>
              <div className="file-list">
                {(goal?.uploadedFiles ?? []).map((f) => (
                  <div key={f.name} className="file-row">
                    <FileTextOutlined style={{ color: '#22c55e' }} />
                    <div className="file-info">
                      <div className="file-name">{f.name}</div>
                      <div className="file-size">{f.size}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* 中央：任务工作流 */}
        <div className="orch-center">
          <SectionCard
            title={
              <span>
                <span className="orch-icon">🔄</span> 任务工作流
              </span>
            }
            extra={
              <div className="workflow-tools">
                <Button size="small" type="text">🔍</Button>
                <Button size="small" type="text">⛶</Button>
                <Button size="small" type="text">⊕</Button>
                <Button size="small" type="text">⊖</Button>
                <Button size="small" type="text">⊟</Button>
                <Button size="small" type="text">⊞</Button>
                <Button size="small" type="text">⊠</Button>
              </div>
            }
            bodyHeight={520}
            className="flow-card-wrapper"
          >
            <div className="flow-wrapper">
              <ReactFlow
                nodes={initialNodes}
                edges={initialEdges}
                nodeTypes={nodeTypes}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                proOptions={{ hideAttribution: true }}
                minZoom={0.5}
                maxZoom={1.5}
              >
                <Background color="#e5e7eb" gap={20} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
            <div className="flow-abnormal-panel">
              <div className="abnormal-title">⚠ 异常分支</div>
              {branches.map((b) => (
                <div key={b.title} className="abnormal-item">
                  · {b.title}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* 右侧：智能体列表 */}
        <div className="orch-right">
          <SectionCard
            title={
              <span>
                <span className="orch-icon">🤖</span> 智能体列表
              </span>
            }
            bodyHeight={520}
          >
            <div className="orch-agent-list">
              {agents.map((a) => (
                <div key={a.id} className="orch-agent-card">
                  <div className="orch-agent-header">
                    <div className="orch-agent-name">
                      <span
                        className="agent-role-dot"
                        style={{ background: roleColors[a.role] }}
                      />
                      <span className="agent-name-text">{a.name}</span>
                      {a.isPrimary && <Tag color="blue" className="primary-mini-tag">主控</Tag>}
                    </div>
                    <Tag color="success" className="running-mini-tag">运行中</Tag>
                  </div>
                  <div className="orch-agent-stats">
                    <span>负载 <b className="num-font">{a.load}%</b></span>
                    <span>延迟 <b className="num-font">{a.latency}ms</b></span>
                    <span>成功率 <b className="num-font">{a.successRate}%</b></span>
                  </div>
                  <svg viewBox="0 0 200 30" width="100%" height="30" className="agent-spark-mini">
                    <polyline
                      fill="none"
                      stroke={roleColors[a.role]}
                      strokeWidth="1.5"
                      points={a.sparkline.map((v, i) => `${(i / (a.sparkline.length - 1)) * 200},${30 - (v / 100) * 26}`).join(' ')}
                    />
                  </svg>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* 底部：任务队列 + 策略参数 */}
      <div className="orch-bottom-grid">
        <SectionCard
          title={
            <span>
              <span className="orch-icon">📊</span> 任务队列
            </span>
          }
          extra={
            <div className="queue-tabs">
              <a className="active">全部</a>
              <a>进行中</a>
              <a>待执行</a>
              <a>已完成</a>
              <a>异常</a>
              <Button size="small" type="text">🔄</Button>
              <span className="more-link">更多 ▾</span>
            </div>
          }
        >
          <div className="queue-table">
            <div className="queue-header">
              <div>任务 ID</div>
              <div>类型</div>
              <div>执行设备</div>
              <div>目标站点</div>
              <div>状态</div>
              <div>进度</div>
              <div>预计完成时间</div>
            </div>
            {queue.map((t) => (
              <div key={t.id} className="queue-row">
                <div className="num-font">{t.id}</div>
                <div>{t.type === 'pick' ? '拣选出库' : t.type === 'pack' ? '补货上架' : t.type === 'move' ? '盘点巡检' : '充电任务'}</div>
                <div className="num-font">{t.assignedRobotId}</div>
                <div className="num-font">{t.fromStationId ?? t.toStationId}</div>
                <div><TaskStatusTag status={t.status} /></div>
                <div>
                  <div className="queue-progress">
                    <div className="queue-progress-bg">
                      <div className="queue-progress-fill" style={{ width: `${t.progress}%`, background: t.status === 'abnormal' ? '#ef4444' : '#2b6fff' }} />
                    </div>
                    <span className="num-font queue-progress-val">{t.progress}%</span>
                  </div>
                </div>
                <div className="num-font">{t.eta}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={
            <span>
              <span className="orch-icon">⚙️</span> 策略参数
            </span>
          }
        >
          <div className="strategy-grid">
            <div className="strategy-row">
              <span className="strategy-label">任务分配策略</span>
              <Select size="small" defaultValue={strategy?.taskAllocation} style={{ width: 180 }} options={strategy ? [{ value: strategy.taskAllocation, label: strategy.taskAllocation }] : []} />
            </div>
            <div className="strategy-row">
              <span className="strategy-label">优先级规则</span>
              <Select size="small" defaultValue={strategy?.priorityRule} style={{ width: 180 }} options={strategy ? [{ value: strategy.priorityRule, label: strategy.priorityRule }] : []} />
            </div>
            <div className="strategy-row">
              <span className="strategy-label">拥堵惩罚系数</span>
              <InputNumber size="small" defaultValue={strategy?.congestionFactor} step={0.05} style={{ width: 180 }} />
            </div>
            <div className="strategy-row">
              <span className="strategy-label">重试次数（次）</span>
              <InputNumber size="small" defaultValue={strategy?.retryCount} min={0} max={10} style={{ width: 180 }} />
            </div>
            <div className="strategy-row">
              <span className="strategy-label">充电阈值（%）</span>
              <InputNumber size="small" defaultValue={strategy?.chargeThreshold} min={0} max={100} style={{ width: 180 }} />
            </div>
            <div className="strategy-row">
              <span className="strategy-label">异常超时（秒）</span>
              <InputNumber size="small" defaultValue={strategy?.timeoutSec} min={1} style={{ width: 180 }} />
            </div>
            <div className="strategy-save">
              <Button type="primary" icon={<SaveOutlined />} onClick={() => message.success('策略参数已保存并应用到仿真')}>保存并应用</Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
