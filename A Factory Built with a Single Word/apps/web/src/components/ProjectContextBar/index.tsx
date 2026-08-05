import { useNavigate } from 'react-router-dom';
import { Breadcrumb, Button, Space, Tag } from 'antd';
import { EditOutlined, HomeOutlined } from '@ant-design/icons';
import { useProjectWorkspace, useScenario } from '@/api/modules';

interface Props {
  projectId: string;
  scenarioId?: string;
  simulationId?: string;
  simulationStatus?: string;
  /** Extra action buttons shown on the right */
  actions?: React.ReactNode[];
}

/** Map raw simulation status to a localised Chinese label + tone. */
const SIMULATION_STATUS_MAP: Record<string, { label: string; color: string }> = {
  running: { label: '运行中', color: 'green' },
  paused: { label: '已暂停', color: 'gold' },
  stopped: { label: '已停止', color: 'red' },
  completed: { label: '已完成', color: 'blue' },
  created: { label: '未启动', color: 'default' },
  failed: { label: '异常', color: 'volcano' },
  draft: { label: '草稿', color: 'default' },
};

function resolveSimulationStatus(status: string | undefined) {
  if (!status) return null;
  return SIMULATION_STATUS_MAP[status] ?? { label: status, color: 'blue' };
}

export function ProjectContextBar({ projectId, scenarioId, simulationId, simulationStatus, actions }: Props) {
  const navigate = useNavigate();
  const { data: workspace } = useProjectWorkspace(projectId);
  const { data: scenario } = useScenario(scenarioId ?? '');

  const projectName = workspace?.project?.name ?? projectId.slice(0, 8);
  const scenarioName = scenario?.name;

  const items: Array<{ title: React.ReactNode }> = [
    { title: <span onClick={() => navigate('/projects')} style={{ cursor: 'pointer' }}>项目中心</span> },
    { title: <span onClick={() => navigate(`/projects/${projectId}`)} style={{ cursor: 'pointer' }}>{projectName}</span> },
  ];
  if (scenarioName) {
    items.push({
      title: scenarioId
        ? <span onClick={() => navigate(`/editor?projectId=${projectId}&scenarioId=${scenarioId}`)} style={{ cursor: 'pointer' }}>{scenarioName}</span>
        : scenarioName,
    });
  }
  if (simulationId) {
    const resolved = resolveSimulationStatus(simulationStatus);
    items.push({
      title: resolved
        ? <Tag color={resolved.color}>{resolved.label}</Tag>
        : '仿真运行',
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 8 }}>
      <Breadcrumb items={items} />
      <Space size={4}>
        <Button size="small" icon={<HomeOutlined />} onClick={() => navigate('/projects')}>项目中心</Button>
        {scenarioId && (
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/editor?projectId=${projectId}&scenarioId=${scenarioId}`)}>
            {simulationId ? '回到编辑器' : '打开编辑器'}
          </Button>
        )}
        {actions}
      </Space>
    </div>
  );
}
