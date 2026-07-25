import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenterOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DragOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  HomeOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  ReloadOutlined,
  SaveOutlined,
  SelectOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Drawer,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SceneComponent } from '@ican/contracts';
import type {
  ScenarioData,
  ScenarioRead,
  ScenarioValidationRead,
  ScenarioVersionRead,
} from '@/api/dtos/backend';
import {
  ScenarioConflictError,
  ScenarioValidationError,
  useAutoLayoutScenario,
  useCreateSimulation,
  useSaveScenario,
  useScenario,
  useScenarioVersions,
  validateScenario,
} from '@/api/modules';
import { scenarioReadToEditorState } from '@/api/mappers/scenarioMapper';
import { getApiErrorMessage } from '@/api/errorMessage';

import { ProjectContextBar } from '@/components';
import { useAppStore } from '@/stores/useAppStore';
import { useCan } from '@/utils/roleGuard';
import {
  clampComponentToCanvas,
  cloneComponents,
  createSceneComponent,
  DEFAULT_SCENARIO_CANVAS,
  isFormInteractionTarget,
  sceneOverview,
  validateSceneLocally,
} from '@/utils/sceneEditor';
import { editorComponentLibrary } from '@/config/editorCatalog';
import './index.css';

type EditorTool = 'select' | 'move' | 'delete';
type SaveStatus = 'saved' | 'dirty' | 'saving' | 'conflict' | 'invalid' | 'error';
type PropertyTab = 'properties' | 'validation';

interface OperationLog {
  time: string;
  action: string;
  target?: string;
  details?: string;
}

const HISTORY_LIMIT = 30;
const colorMap: Record<SceneComponent['type'], string> = {
  shelf: '#3b82f6', agv: '#06b6d4', arm: '#a855f7', conveyor: '#22c55e',
  station: '#f59e0b', charger: '#10b981', obstacle: '#64748b',
};
const iconMap: Record<SceneComponent['type'], string> = {
  shelf: '▤', agv: '◆', arm: '●', conveyor: '⇢', station: '▣', charger: 'ϟ', obstacle: '▰',
};
const typeLabels: Record<SceneComponent['type'], string> = {
  shelf: '货架', agv: 'AGV', arm: '机械臂', conveyor: '输送线', station: '工作站', charger: '充电桩', obstacle: '障碍物',
};
const saveStatusMeta: Record<SaveStatus, { color: string; text: string }> = {
  saved: { color: 'success', text: '已保存' },
  dirty: { color: 'warning', text: '有未保存修改' },
  saving: { color: 'processing', text: '保存中' },
  conflict: { color: 'error', text: '版本冲突' },
  invalid: { color: 'error', text: '校验未通过' },
  error: { color: 'error', text: '保存失败' },
};

export default function Editor() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storedProjectId = useAppStore((state) => state.currentProjectId);
  const storedScenarioId = useAppStore((state) => state.currentScenarioId);
  const setProjectContext = useAppStore((state) => state.setProjectContext);
  const canEdit = useCan('edit_scene');
  const canRun = useCan('run_simulation');
  const urlProjectId = searchParams.get('projectId');
  const urlScenarioId = searchParams.get('scenarioId');
  const scenarioId = urlScenarioId || storedScenarioId || '';
  const contextProjectId = urlProjectId || storedProjectId || '';

  const scenarioQuery = useScenario(scenarioId);
  const saveMutation = useSaveScenario(scenarioId);
  const autoLayoutMutation = useAutoLayoutScenario(scenarioId);
  const createSimulationMutation = useCreateSimulation();
  const versionsQuery = useScenarioVersions(scenarioId);

  const [components, setComponents] = useState<SceneComponent[]>([]);
  const [canvas, setCanvas] = useState<ScenarioData['canvas']>(DEFAULT_SCENARIO_CANVAS);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioVersion, setScenarioVersion] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<EditorTool>('select');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [past, setPast] = useState<SceneComponent[][]>([]);
  const [future, setFuture] = useState<SceneComponent[][]>([]);
  const [zoom, setZoom] = useState(100);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [activeTab, setActiveTab] = useState<PropertyTab>('properties');
  const [validation, setValidation] = useState<ScenarioValidationRead>(() => validateSceneLocally([], DEFAULT_SCENARIO_CANVAS));
  const [validating, setValidating] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customType, setCustomType] = useState<SceneComponent['type']>('shelf');
  const [customName, setCustomName] = useState('自定义设备');
  const [customWidth, setCustomWidth] = useState(100);
  const [customHeight, setCustomHeight] = useState(50);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const loadedScenarioRef = useRef<string | null>(null);
  const validationSequenceRef = useRef(0);

  const selected = components.find((component) => component.id === selectedId) ?? null;
  const effectiveProjectId = scenarioQuery.data?.project_id || contextProjectId;
  const localValidation = useMemo(() => validateSceneLocally(components, canvas), [components, canvas]);
  const stats = useMemo(() => sceneOverview(components, canvas), [components, canvas]);
  const appliedStrategy = useMemo(() => {
    const value = components.find((component) => typeof component.properties?.layout_strategy === 'string')?.properties?.layout_strategy;
    const labels: Record<string, string> = {
      balanced: '均衡调度方案',
      throughput: '峰值吞吐方案',
      energy_saver: '节能优化方案',
    };
    return typeof value === 'string' ? labels[value] ?? value : null;
  }, [components]);
  const invalidIds = useMemo(
    () => new Set(validation.errors.flatMap((issue) => issue.component_ids)),
    [validation.errors],
  );
  const sortedVersions = useMemo(
    () => [...(versionsQuery.data ?? [])].sort((left, right) => right.version - left.version),
    [versionsQuery.data],
  );
  const groupedLibrary = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    const filtered = editorComponentLibrary.filter((item) =>
      !query || item.name.toLowerCase().includes(query) || item.spec.toLowerCase().includes(query),
    );
    return filtered.reduce<Record<string, typeof editorComponentLibrary>>((groups, item) => {
      (groups[item.category] ??= []).push(item);
      return groups;
    }, {});
  }, [libraryQuery]);

  const addLog = useCallback((action: string, target?: string, details?: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour12: false });
    setLogs((current) => [{ time, action, target, details }, ...current].slice(0, 40));
  }, []);

  const applyScenario = useCallback((read: ScenarioRead, action = '加载场景') => {
    const state = scenarioReadToEditorState(read);
    setComponents(state.components);
    setCanvas(state.canvas);
    setScenarioName(state.name);
    setScenarioVersion(state.version);
    setSelectedId(state.components[0]?.id ?? null);
    setPast([]);
    setFuture([]);
    setSaveStatus('saved');
    setValidation(validateSceneLocally(state.components, state.canvas));
    loadedScenarioRef.current = read.id;
    addLog(action, state.name, `v${state.version}`);
    setProjectContext({ projectId: read.project_id, scenarioId: read.id });
  }, [addLog, setProjectContext]);

  useEffect(() => {
    loadedScenarioRef.current = null;
  }, [scenarioId]);

  useEffect(() => {
    if (scenarioQuery.data && loadedScenarioRef.current !== scenarioQuery.data.id) {
      applyScenario(scenarioQuery.data);
    }
  }, [applyScenario, scenarioQuery.data]);

  useEffect(() => {
    const sequence = ++validationSequenceRef.current;
    setValidation(localValidation);
    if (!scenarioId || saveStatus === 'saved' || !localValidation.valid) {
      setValidating(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setValidating(true);
      try {
        const result = await validateScenario(scenarioId, components, canvas);
        if (validationSequenceRef.current === sequence) setValidation(result);
      } catch {
        if (validationSequenceRef.current === sequence) setValidation(localValidation);
      } finally {
        if (validationSequenceRef.current === sequence) setValidating(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [canvas, components, localValidation, saveStatus, scenarioId]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (saveStatus !== 'saved') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [saveStatus]);

  const pushHistory = useCallback((snapshot: SceneComponent[]) => {
    setPast((current) => [...current, cloneComponents(snapshot)].slice(-HISTORY_LIMIT));
    setFuture([]);
  }, []);

  const markDirty = useCallback(() => {
    setSaveStatus((current) => current === 'saving' ? current : 'dirty');
  }, []);

  const updateComponent = useCallback((id: string, patch: Partial<SceneComponent>, log = true) => {
    if (!canEdit) return;
    setComponents((current) => {
      const existing = current.find((component) => component.id === id);
      if (!existing) return current;
      pushHistory(current);
      const next = current.map((component) => component.id === id
        ? { ...component, ...patch, properties: patch.properties ?? component.properties }
        : component);
      if (log) addLog('修改组件', existing.name);
      return next;
    });
    markDirty();
  }, [addLog, canEdit, markDirty, pushHistory]);

  const addComponent = useCallback((type: SceneComponent['type'], name: string, size?: { width: number; height: number }) => {
    if (!canEdit) return;
    const component = createSceneComponent(type, name, components, canvas, size);
    pushHistory(components);
    setComponents((current) => [...current, component]);
    setSelectedId(component.id);
    setTool('move');
    markDirty();
    addLog('添加组件', component.name, component.id);
  }, [addLog, canEdit, canvas, components, markDirty, pushHistory]);

  const deleteComponent = useCallback((id: string, confirm = true) => {
    if (!canEdit) return;
    const component = components.find((item) => item.id === id);
    if (!component) return;
    const perform = () => {
      pushHistory(components);
      setComponents((current) => current.filter((item) => item.id !== id));
      setSelectedId((current) => current === id ? null : current);
      markDirty();
      addLog('删除组件', component.name);
    };
    if (!confirm) perform();
    else Modal.confirm({ title: `删除“${component.name}”？`, content: '删除后可通过撤销恢复。', okText: '删除', okButtonProps: { danger: true }, onOk: perform });
  }, [addLog, canEdit, components, markDirty, pushHistory]);

  const undo = useCallback(() => {
    if (!canEdit || !past.length) return;
    const previous = past[past.length - 1];
    setFuture((current) => [cloneComponents(components), ...current]);
    setComponents(cloneComponents(previous));
    setPast((current) => current.slice(0, -1));
    setSelectedId((current) => previous.some((component) => component.id === current) ? current : null);
    markDirty();
    addLog('撤销');
  }, [addLog, canEdit, components, markDirty, past]);

  const redo = useCallback(() => {
    if (!canEdit || !future.length) return;
    const next = future[0];
    setPast((current) => [...current, cloneComponents(components)].slice(-HISTORY_LIMIT));
    setComponents(cloneComponents(next));
    setFuture((current) => current.slice(1));
    markDirty();
    addLog('重做');
  }, [addLog, canEdit, components, future, markDirty]);

  const alignSelected = useCallback((axis: 'left' | 'right' | 'center-h' | 'top' | 'bottom' | 'center-v') => {
    if (!selected) return message.warning('请先选择组件');
    const patch: Partial<SceneComponent> = {};
    if (axis === 'left') patch.x = 0;
    if (axis === 'right') patch.x = canvas.width - selected.width;
    if (axis === 'center-h') patch.x = Math.round((canvas.width - selected.width) / 2);
    if (axis === 'top') patch.y = 0;
    if (axis === 'bottom') patch.y = canvas.height - selected.height;
    if (axis === 'center-v') patch.y = Math.round((canvas.height - selected.height) / 2);
    updateComponent(selected.id, patch);
  }, [canvas, message, selected, updateComponent]);

  const handleDragStart = (event: React.MouseEvent, component: SceneComponent) => {
    if (!canEdit || tool !== 'move') return;
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, componentX: component.x, componentY: component.y };
    const scale = zoom / 100;
    let moved = false;
    let lastPosition = { x: component.x, y: component.y };
    const snapshot = cloneComponents(components);
    const onMove = (moveEvent: MouseEvent) => {
      const position = clampComponentToCanvas(component, canvas, {
        x: start.componentX + (moveEvent.clientX - start.x) / scale,
        y: start.componentY + (moveEvent.clientY - start.y) / scale,
      });
      moved = moved || position.x !== component.x || position.y !== component.y;
      lastPosition = position;
      setComponents((current) => current.map((item) => item.id === component.id ? { ...item, ...position } : item));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved) {
        pushHistory(snapshot);
        markDirty();
        addLog('移动组件', component.name, `(${lastPosition.x}, ${lastPosition.y})`);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleComponentClick = (event: React.MouseEvent, component: SceneComponent) => {
    event.stopPropagation();
    if (tool === 'delete') deleteComponent(component.id);
    else setSelectedId(component.id);
  };

  const handleSave = useCallback(() => {
    if (!canEdit) return message.warning('当前账号只有查看权限');
    if (!scenarioId) return message.warning('缺少场景 ID');
    if (!localValidation.valid) {
      setValidation(localValidation);
      setSaveStatus('invalid');
      setActiveTab('validation');
      return message.error(`场景存在 ${localValidation.errors.length} 个问题，请修复后保存`);
    }
    setSaveStatus('saving');
    saveMutation.mutate({ components, canvas, expectedVersion: scenarioVersion ?? undefined }, {
      onSuccess: (saved) => {
        setComponents(saved.data.components);
        setCanvas(saved.data.canvas);
        setScenarioVersion(saved.version);
        setScenarioName(saved.name);
        setSaveStatus('saved');
        setValidation(validateSceneLocally(saved.data.components, saved.data.canvas));
        addLog('保存场景', saved.name, `v${saved.version}`);
        message.success(`场景已保存为 v${saved.version}`);
      },
      onError: (error) => {
        if (error instanceof ScenarioConflictError) {
          setSaveStatus('conflict');
          message.warning(`服务器已有更新${error.currentVersion ? `（v${error.currentVersion}）` : ''}，请加载最新版本`);
        } else if (error instanceof ScenarioValidationError) {
          setValidation(error.validation);
          setSaveStatus('invalid');
          setActiveTab('validation');
          message.error(error.message);
        } else {
          setSaveStatus('error');
          message.error(getApiErrorMessage(error, '保存失败，请检查后端连接后重试'));
        }
      },
    });
  }, [addLog, canEdit, canvas, components, localValidation, message, saveMutation, scenarioId, scenarioVersion]);

  const updateCanvas = useCallback((patch: Partial<ScenarioData['canvas']>) => {
    if (!canEdit) return;
    setCanvas((current) => ({ ...current, ...patch }));
    markDirty();
  }, [canEdit, markDirty]);

  const fetchLatest = async () => {
    const result = await scenarioQuery.refetch();
    if (!result.data) throw result.error ?? new Error('未读取到场景数据');
    applyScenario(result.data, '加载服务器最新版本');
    message.success(`已加载服务器版本 v${result.data.version}`);
  };

  const handleReload = () => {
    const run = () => void fetchLatest().catch((error) => message.error(getApiErrorMessage(error, '重新加载失败')));
    if (saveStatus === 'saved') run();
    else Modal.confirm({
      title: '放弃本地修改并加载服务器版本？',
      content: '未保存修改将被覆盖。保存过的历史版本不会受影响。',
      okText: '加载最新版本',
      onOk: run,
    });
  };

  const handleValidate = async () => {
    if (!scenarioId) return;
    setValidating(true);
    try {
      const result = await validateScenario(scenarioId, components, canvas);
      setValidation(result);
      setActiveTab('validation');
      if (result.valid) message.success('场景校验通过');
      else message.warning(`发现 ${result.errors.length} 个问题`);
    } catch (error) {
      message.error(getApiErrorMessage(error, '校验服务不可用'));
    } finally {
      setValidating(false);
    }
  };

  const handleAutoLayout = () => {
    if (!canEdit) return;
    autoLayoutMutation.mutate({ components, canvas }, {
      onSuccess: (result) => {
        pushHistory(components);
        setComponents(cloneComponents(result.data.components));
        setCanvas(result.data.canvas);
        setValidation(result.validation);
        setSelectedId(result.data.components[0]?.id ?? null);
        markDirty();
        addLog('自动布局', undefined, `${result.data.components.length} 个组件`);
        message.success('自动布局已生成，请检查并保存');
      },
      onError: (error) => message.error(getApiErrorMessage(error, '自动布局失败')),
    });
  };

  const restoreVersion = (version: ScenarioVersionRead) => {
    const perform = () => {
      pushHistory(components);
      setComponents(cloneComponents(version.data.components));
      setCanvas({ ...version.data.canvas });
      setSelectedId(version.data.components[0]?.id ?? null);
      setSaveStatus('dirty');
      setVersionsOpen(false);
      addLog('恢复历史快照', version.name, `v${version.version}`);
      message.info(`已载入 v${version.version} 快照，保存后将生成新版本`);
    };
    Modal.confirm({ title: `载入历史版本 v${version.version}？`, content: '该操作只替换当前画布，点击保存后才会写入服务器。', okText: '载入快照', onOk: perform });
  };

  const enterSimulation = async () => {
    if (!canRun) return message.warning('当前账号没有运行仿真的权限');
    if (!effectiveProjectId || !scenarioId) return message.warning('缺少项目或场景上下文');

    // Derive robot_count from scene AGV components — closes the data loop
    // so the editor's AGVs match the simulation's AGVs.
    const agvCount = components.filter((c) => c.type === 'agv').length;
    if (components.length === 0) {
      return message.warning('场景为空，请先添加设备组件再进入仿真');
    }
    if (agvCount === 0) {
      return message.warning('场景中没有 AGV，请至少添加一台 AGV 再进入仿真');
    }

    // 如果有未保存修改，先自动保存再进入仿真
    let currentVersion = scenarioVersion;
    if (saveStatus !== 'saved') {
      try {
        const saved = await saveMutation.mutateAsync({ components, canvas, expectedVersion: scenarioVersion ?? undefined });
        setComponents(saved.data.components);
        setCanvas(saved.data.canvas);
        currentVersion = saved.version;
        setScenarioVersion(saved.version);
        setSaveStatus('saved');
      } catch {
        return message.error('保存失败，无法进入仿真');
      }
    }

    try {
      const run = await createSimulationMutation.mutateAsync({
        project_id: effectiveProjectId,
        scenario_id: scenarioId,
        // Don't send robot_count — let the backend derive it from the
        // scenario snapshot. This ensures the count always matches the
        // editor's AGV components.
        order_count: Math.max(30, agvCount * 8),
        random_seed: Date.now() % 2_147_483_647,
        scenario_version: currentVersion,
      });
      setProjectContext({ projectId: effectiveProjectId, scenarioId, simulationId: run.id });
      if (!effectiveProjectId) {
        message.error('缺少项目 ID，无法跳转仿真');
        return;
      }
      navigate(`/simulation?projectId=${encodeURIComponent(effectiveProjectId)}&scenarioId=${encodeURIComponent(scenarioId)}&simulationId=${encodeURIComponent(run.id)}`);
    } catch (error) {
      message.error(getApiErrorMessage(error, '创建仿真运行失败，请检查后端连接后重试'));
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFormInteractionTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault(); undo();
      } else if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
        event.preventDefault(); redo();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault(); deleteComponent(selectedId);
      } else if (event.key === 'Escape') {
        setSelectedId(null); setTool('select');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteComponent, handleSave, redo, selectedId, undo]);

  if (!scenarioId) {
    return (
      <div className="editor-state-card">
        <Empty description="没有可编辑的场景">
          <p>请先从首页创建项目与场景，或在项目中心打开已有场景。</p>
          <Space><Button icon={<HomeOutlined />} onClick={() => navigate('/')}>创建场景</Button><Button type="primary" icon={<FolderOpenOutlined />} onClick={() => navigate('/projects')}>项目中心</Button></Space>
        </Empty>
      </div>
    );
  }

  if (scenarioQuery.isLoading && !scenarioQuery.data) {
    return <div className="editor-state-card"><Skeleton active paragraph={{ rows: 12 }} /></div>;
  }

  if (scenarioQuery.isError && !scenarioQuery.data) {
    return (
      <div className="editor-state-card">
        <Alert type="error" showIcon message="场景加载失败" description={`${getApiErrorMessage(scenarioQuery.error, '场景不存在、无访问权限或后端未启动')}（ID: ${scenarioId}）`} action={<Space direction="vertical"><Button onClick={() => void scenarioQuery.refetch()}>重试</Button><Button onClick={() => navigate('/projects')}>返回项目中心</Button></Space>} />
      </div>
    );
  }

  return (
    <div className="editor-page">
      {!canEdit && <Alert type="info" showIcon message="只读场景" description="当前账号可以查看场景、校验结果和历史版本，但不能修改或保存。" />}
      {contextProjectId && scenarioQuery.data && contextProjectId !== scenarioQuery.data.project_id && (
        <Alert type="warning" showIcon message="项目上下文已纠正" description="URL 中的项目 ID 与场景归属不一致，后续操作将以服务器返回的项目为准。" />
      )}
      {saveStatus === 'conflict' && (
        <Alert type="error" showIcon message="版本冲突：服务器场景已被其他会话修改" description="加载最新版本会放弃当前本地修改；也可以先查看历史版本确认差异。" action={<Space><Button onClick={() => setVersionsOpen(true)}>查看版本</Button><Button danger onClick={handleReload}>加载最新版本</Button></Space>} />
      )}

      <header className="editor-header">
        <div className="editor-header-left">
          <div className="editor-eyebrow">SCENE WORKSPACE · {scenarioId.slice(0, 8)}</div>
          <h1 className="editor-title">{scenarioName || '仓库场景'} <Tag color={saveStatusMeta[saveStatus].color}>{saveStatusMeta[saveStatus].text}</Tag><Tag>v{scenarioVersion ?? '—'}</Tag></h1>
          {effectiveProjectId && <ProjectContextBar projectId={effectiveProjectId} scenarioId={scenarioId} />}
        </div>
        <div className="editor-header-right">
          <Button icon={<HistoryOutlined />} onClick={() => setVersionsOpen(true)}>版本</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReload} loading={scenarioQuery.isFetching}>重新加载</Button>
          <Button icon={<ThunderboltOutlined />} onClick={handleAutoLayout} loading={autoLayoutMutation.isPending} disabled={!canEdit || !components.length}>自动布局</Button>
          <Button icon={<CheckCircleOutlined />} onClick={() => void handleValidate()} loading={validating}>校验</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saveMutation.isPending} disabled={!canEdit}>保存</Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => void enterSimulation()} loading={createSimulationMutation.isPending} disabled={!canRun}>进入仿真</Button>
        </div>
      </header>

      <div className="editor-grid">
        <aside className="editor-lib">
          <Input.Search value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="搜索组件或规格" allowClear />
          <div className="lib-list">
            {!Object.keys(groupedLibrary).length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配组件" />}
            {Object.entries(groupedLibrary).map(([category, items]) => (
              <section className="lib-group" key={category}>
                <div className="lib-group-title">{typeLabels[category as SceneComponent['type']] ?? category}</div>
                {items.map((item) => (
                  <button key={item.name} type="button" className="lib-item" disabled={!canEdit} onClick={() => addComponent(item.category as SceneComponent['type'], item.name)}>
                    <span className="lib-item-icon" style={{ color: item.iconColor, background: `${item.iconColor}18` }}>{iconMap[item.category as SceneComponent['type']]}</span>
                    <span className="lib-item-body"><b>{item.name}</b><small>{item.spec}</small></span>
                    <PlusOutlined />
                  </button>
                ))}
              </section>
            ))}
          </div>
          <Button type="dashed" icon={<PlusOutlined />} disabled={!canEdit} onClick={() => setCustomOpen(true)}>自定义组件</Button>
        </aside>

        <main className="editor-canvas-wrap">
          <div className="canvas-toolbar">
            <Button type={tool === 'select' ? 'primary' : 'default'} icon={<SelectOutlined />} onClick={() => setTool('select')}>选择</Button>
            <Button type={tool === 'move' ? 'primary' : 'default'} icon={<DragOutlined />} onClick={() => setTool('move')} disabled={!canEdit}>移动</Button>
            <Button type={tool === 'delete' ? 'primary' : 'default'} danger={tool === 'delete'} icon={<DeleteOutlined />} onClick={() => setTool('delete')} disabled={!canEdit}>删除</Button>
            <Button.Group>
              <Button icon={<UndoOutlined />} onClick={undo} disabled={!canEdit || !past.length}>撤销</Button>
              <Button icon={<RedoOutlined />} onClick={redo} disabled={!canEdit || !future.length}>重做</Button>
            </Button.Group>
            <Dropdown menu={{ items: [
              { key: 'left', label: '左对齐', onClick: () => alignSelected('left') },
              { key: 'right', label: '右对齐', onClick: () => alignSelected('right') },
              { key: 'center-h', label: '水平居中', onClick: () => alignSelected('center-h') },
              { type: 'divider' },
              { key: 'top', label: '顶部对齐', onClick: () => alignSelected('top') },
              { key: 'bottom', label: '底部对齐', onClick: () => alignSelected('bottom') },
              { key: 'center-v', label: '垂直居中', onClick: () => alignSelected('center-v') },
            ] }}><Button icon={<AlignCenterOutlined />} disabled={!canEdit || !selected}>对齐</Button></Dropdown>
            {selected && <Button icon={<ReloadOutlined />} disabled={!canEdit} onClick={() => updateComponent(selected.id, { rotation: (selected.rotation + 90) % 360 })}>旋转</Button>}
          </div>
          <div className="editor-canvas" onClick={() => setSelectedId(null)}>
            {!components.length && <div className="canvas-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这是一个空场景"><Button type="primary" icon={<PlusOutlined />} disabled={!canEdit} onClick={(event) => { event.stopPropagation(); addComponent('shelf', '标准货架'); }}>添加第一个组件</Button></Empty></div>}
            <div className="canvas-stage" style={{ width: canvas.width * zoom / 100, height: canvas.height * zoom / 100 }}>
              <div className="canvas-grid" style={{ width: canvas.width, height: canvas.height, transform: `scale(${zoom / 100})`, transformOrigin: '0 0' }}>
                {components.map((component) => (
                  <Tooltip key={component.id} title={`${component.name} · (${component.x}, ${component.y})`} mouseEnterDelay={0.5}>
                    <div
                      className={`canvas-component type-${component.type} ${selectedId === component.id ? 'selected' : ''} ${invalidIds.has(component.id) ? 'invalid' : ''}`}
                      style={{ left: component.x, top: component.y, width: component.width, height: component.height, color: colorMap[component.type], background: `${colorMap[component.type]}22`, borderColor: colorMap[component.type], transform: `rotate(${component.rotation}deg)`, cursor: tool === 'move' ? 'move' : tool === 'delete' ? 'not-allowed' : 'pointer' }}
                      onClick={(event) => handleComponentClick(event, component)}
                      onMouseDown={(event) => handleDragStart(event, component)}
                    >
                      <span>{iconMap[component.type]}</span><b>{component.name}</b>
                    </div>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
          <footer className="canvas-bottom">
            <Space.Compact><Button icon={<ZoomOutOutlined />} onClick={() => setZoom((value) => Math.max(40, value - 10))} /><Button className="zoom-value" onClick={() => setZoom(100)}>{zoom}%</Button><Button icon={<ZoomInOutlined />} onClick={() => setZoom((value) => Math.min(180, value + 10))} /></Space.Compact>
            <span className="canvas-hint">{tool === 'move' ? '拖动组件调整位置' : tool === 'delete' ? '点击组件删除' : '点击组件查看属性'} · Ctrl+S 保存 · Delete 删除 · Esc 取消选择</span>
            <Tag color={validation.valid ? 'success' : 'error'}>{validating ? '校验中' : validation.valid ? '校验通过' : `${validation.errors.length} 个问题`}</Tag>
          </footer>
        </main>

        <aside className="editor-aside">
          <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as PropertyTab)} items={[
            { key: 'properties', label: '组件属性' },
            { key: 'validation', label: <span>场景校验 {validation.errors.length > 0 && <Tag color="error">{validation.errors.length}</Tag>}</span> },
          ]} />
          {activeTab === 'properties' ? (
            selected ? <div className="prop-list">
              <div className="aside-selection"><span style={{ background: `${colorMap[selected.type]}20`, color: colorMap[selected.type] }}>{iconMap[selected.type]}</span><div><b>{selected.name}</b><small>{selected.id}</small></div></div>
              <PropertyField label="名称"><Input value={selected.name} disabled={!canEdit} maxLength={120} onChange={(event) => updateComponent(selected.id, { name: event.target.value }, false)} /></PropertyField>
              <PropertyField label="类型"><Select value={selected.type} disabled options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} /></PropertyField>
              <div className="property-grid"><PropertyField label="X"><InputNumber value={selected.x} min={0} max={Math.max(0, canvas.width - selected.width)} disabled={!canEdit} onChange={(value) => value !== null && updateComponent(selected.id, { x: value }, false)} /></PropertyField><PropertyField label="Y"><InputNumber value={selected.y} min={0} max={Math.max(0, canvas.height - selected.height)} disabled={!canEdit} onChange={(value) => value !== null && updateComponent(selected.id, { y: value }, false)} /></PropertyField></div>
              <div className="property-grid"><PropertyField label="宽度"><InputNumber value={selected.width} min={1} max={canvas.width} disabled={!canEdit} onChange={(value) => value !== null && updateComponent(selected.id, { width: value }, false)} /></PropertyField><PropertyField label="高度"><InputNumber value={selected.height} min={1} max={canvas.height} disabled={!canEdit} onChange={(value) => value !== null && updateComponent(selected.id, { height: value }, false)} /></PropertyField></div>
              <PropertyField label="旋转角度"><InputNumber value={selected.rotation} min={0} max={359} addonAfter="°" disabled={!canEdit} onChange={(value) => value !== null && updateComponent(selected.id, { rotation: value }, false)} /></PropertyField>
              {selected.type === 'shelf' && <PropertyField label="货架容量"><InputNumber value={Number(selected.properties.capacity ?? 200)} min={1} addonAfter="托" disabled={!canEdit} onChange={(value) => value !== null && updateComponent(selected.id, { properties: { ...selected.properties, capacity: value } }, false)} /></PropertyField>}
              {selected.type === 'agv' && <PropertyField label="初始电量"><InputNumber value={Number(selected.properties.battery ?? 100)} min={0} max={100} addonAfter="%" disabled={!canEdit} onChange={(value) => value !== null && updateComponent(selected.id, { properties: { ...selected.properties, battery: value } }, false)} /></PropertyField>}
              <Button danger block icon={<DeleteOutlined />} disabled={!canEdit} onClick={() => deleteComponent(selected.id)}>删除组件</Button>
            </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一个组件查看属性" />
          ) : <ValidationPanel validation={validation} validating={validating} onSelect={(id) => { setSelectedId(id); setActiveTab('properties'); }} />}
          <div className="canvas-settings">
            <h3>画布设置</h3>
            <div className="property-grid"><PropertyField label="宽度"><InputNumber value={canvas.width} min={320} max={5000} disabled={!canEdit} onChange={(value) => value !== null && updateCanvas({ width: value })} /></PropertyField><PropertyField label="高度"><InputNumber value={canvas.height} min={240} max={5000} disabled={!canEdit} onChange={(value) => value !== null && updateCanvas({ height: value })} /></PropertyField></div>
            <PropertyField label="坐标比例"><InputNumber value={canvas.scale} min={0.1} max={10} step={0.1} disabled={!canEdit} onChange={(value) => value !== null && updateCanvas({ scale: value })} /></PropertyField>
          </div>
        </aside>
      </div>

      <div className="editor-bottom">
        <section className="editor-summary">
          <SummaryItem label="货架" value={stats.shelves} unit="组" /><SummaryItem label="AGV" value={stats.agvs} unit="台" /><SummaryItem label="机械臂" value={stats.arms} unit="台" /><SummaryItem label="工作站" value={stats.stations} unit="个" /><SummaryItem label="占用面积" value={stats.occupiedArea} unit="px²" /><SummaryItem label="可通行率" value={stats.passableRate} unit="%" />
        </section>
        <section className="editor-log"><div className="section-heading"><b>本次编辑记录</b><span>{logs.length} 条</span></div>{logs.length ? logs.map((log, index) => <div className="log-row" key={`${log.time}-${index}`}><time>{log.time}</time><b>{log.action}</b><span>{log.target}</span><small>{log.details}</small></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无编辑操作" />}</section>
      </div>

      <Drawer title="场景版本历史" width={500} open={versionsOpen} onClose={() => setVersionsOpen(false)}>
        {versionsQuery.isLoading ? <Skeleton active /> : versionsQuery.isError ? <Alert type="error" showIcon message="版本历史加载失败" action={<Button onClick={() => void versionsQuery.refetch()}>重试</Button>} /> : <List dataSource={sortedVersions} locale={{ emptyText: '暂无历史版本' }} renderItem={(version) => <List.Item actions={[<Button key="restore" type="link" disabled={!canEdit || version.version === scenarioVersion} onClick={() => restoreVersion(version)}>{version.version === scenarioVersion ? '当前版本' : '载入快照'}</Button>]}><List.Item.Meta avatar={<div className={`version-dot ${version.version === scenarioVersion ? 'current' : ''}`}>v{version.version}</div>} title={version.name} description={`${version.data.components.length} 个组件 · ${new Date(version.created_at).toLocaleString()}`} /></List.Item>} />}
      </Drawer>

      <Modal title="添加自定义组件" open={customOpen} onCancel={() => setCustomOpen(false)} onOk={() => { addComponent(customType, customName.trim() || '自定义组件', { width: customWidth, height: customHeight }); setCustomOpen(false); }} okButtonProps={{ disabled: !customName.trim() || customWidth <= 0 || customHeight <= 0 }}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}><PropertyField label="组件类型"><Select value={customType} onChange={setCustomType} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} /></PropertyField><PropertyField label="名称"><Input value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={120} /></PropertyField><div className="property-grid"><PropertyField label="宽度"><InputNumber value={customWidth} min={1} max={canvas.width} onChange={(value) => value !== null && setCustomWidth(value)} /></PropertyField><PropertyField label="高度"><InputNumber value={customHeight} min={1} max={canvas.height} onChange={(value) => value !== null && setCustomHeight(value)} /></PropertyField></div></Space>
      </Modal>
    </div>
  );
}

function PropertyField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="property-field"><span>{label}</span>{children}</label>;
}

function ValidationPanel({ validation, validating, onSelect }: { validation: ScenarioValidationRead; validating: boolean; onSelect: (id: string) => void }) {
  const issues = [...validation.errors.map((issue) => ({ ...issue, severity: 'error' as const })), ...validation.warnings.map((issue) => ({ ...issue, severity: 'warning' as const }))];
  if (validating) return <Skeleton active paragraph={{ rows: 5 }} />;
  if (!issues.length) return <div className="validation-success"><CheckCircleOutlined /><b>场景校验通过</b><span>边界、重叠、组件 ID 与数据结构均有效。</span></div>;
  return <div className="validation-list">{issues.map((issue, index) => <button type="button" key={`${issue.code}-${index}`} className={`validation-item ${issue.severity}`} onClick={() => issue.component_ids[0] && onSelect(issue.component_ids[0])}><span>{issue.severity === 'error' ? <ExclamationCircleOutlined /> : '!'}</span><div><b>{issue.code}</b><p>{issue.message}</p></div></button>)}</div>;
}

function SummaryItem({ label, value, unit }: { label: string; value: number; unit: string }) {
  return <div className="summary-item"><span>{label}</span><b>{value}<small>{unit}</small></b></div>;
}
