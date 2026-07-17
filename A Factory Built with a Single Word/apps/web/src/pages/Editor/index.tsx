import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenterOutlined,
  ColumnHeightOutlined,
  DeleteOutlined,
  DragOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  ReloadOutlined,
  SaveOutlined,
  SelectOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { App, Button, Dropdown, Input, InputNumber, Modal, Select, Tabs, Tag } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SectionCard } from '@/components';
import type { SceneComponent } from '@ican/contracts';
import type { ScenarioData } from '@/api/dtos/backend';
import {
  ScenarioConflictError,
  ScenarioValidationError,
  useAutoLayoutScenario,
  useScenario,
  useSaveScenario,
  createSimulation,
} from '@/api/modules';
import { useAppStore } from '@/stores/useAppStore';
import {
  editorComponentLibrary,
  editorOperationLogs,
  editorOverview,
  editorSceneRules,
  editorTools,
} from '@ican/mock-data';
import './index.css';

const toolIconMap: Record<string, React.ReactNode> = {
  SelectOutlined: <SelectOutlined />,
  DragOutlined: <DragOutlined />,
  ReloadOutlined: <ReloadOutlined />,
  DeleteOutlined: <DeleteOutlined />,
  AlignCenterOutlined: <AlignCenterOutlined />,
  TagsOutlined: <TagsOutlined />,
  ColumnHeightOutlined: <ColumnHeightOutlined />,
};

const colorMap: Record<string, string> = {
  shelf: '#3b82f6',
  agv: '#06b6d4',
  arm: '#a855f7',
  conveyor: '#22c55e',
  station: '#f59e0b',
  charger: '#10b981',
  obstacle: '#64748b',
};

const initialComponents: SceneComponent[] = [
  { id: 'shelf-A1', type: 'shelf', name: 'A 区货架 - 01', x: 200, y: 200, width: 240, height: 80, rotation: 0, properties: { zone: 'A', doubleSided: true, capacity: 200 } },
  { id: 'shelf-A2', type: 'shelf', name: 'A 区货架 - 02', x: 460, y: 200, width: 240, height: 80, rotation: 0, properties: { zone: 'A', doubleSided: true, capacity: 200 } },
  { id: 'shelf-A3', type: 'shelf', name: 'A 区货架 - 03', x: 200, y: 320, width: 240, height: 80, rotation: 0, properties: { zone: 'A', doubleSided: true, capacity: 200 } },
  { id: 'shelf-B1', type: 'shelf', name: 'B 区货架 - 01', x: 760, y: 200, width: 240, height: 80, rotation: 0, properties: { zone: 'B', doubleSided: true, capacity: 200 } },
  { id: 'shelf-C1', type: 'shelf', name: 'C 区货架 - 01', x: 200, y: 460, width: 240, height: 80, rotation: 0, properties: { zone: 'C', doubleSided: true, capacity: 200 } },
  { id: 'shelf-D1', type: 'shelf', name: 'D 区货架 - 01', x: 760, y: 460, width: 240, height: 80, rotation: 0, properties: { zone: 'D', doubleSided: true, capacity: 200 } },
  { id: 'station-pick-1', type: 'station', name: '拣选工作站 - 01', x: 400, y: 130, width: 80, height: 50, rotation: 0, properties: { type: 'pick' } },
  { id: 'station-pack-1', type: 'station', name: '包装工作站 - 01', x: 600, y: 130, width: 80, height: 50, rotation: 0, properties: { type: 'pack' } },
  { id: 'arm-1', type: 'arm', name: '机械臂 - 01', x: 530, y: 280, width: 40, height: 40, rotation: 0, properties: {} },
  { id: 'charger-1', type: 'charger', name: '充电桩 - 01', x: 480, y: 580, width: 30, height: 30, rotation: 0, properties: {} },
  { id: 'charger-2', type: 'charger', name: '充电桩 - 02', x: 540, y: 580, width: 30, height: 30, rotation: 0, properties: {} },
  { id: 'agv-1', type: 'agv', name: 'AGV-001', x: 380, y: 400, width: 24, height: 16, rotation: 0, properties: { battery: 85 } },
  { id: 'agv-2', type: 'agv', name: 'AGV-002', x: 620, y: 400, width: 24, height: 16, rotation: 0, properties: { battery: 62 } },
];

const HISTORY_LIMIT = 30;
type SaveStatus = 'saved' | 'dirty' | 'saving' | 'conflict' | 'invalid' | 'error';

const saveStatusMeta: Record<SaveStatus, { color: string; text: string }> = {
  saved: { color: 'success', text: '已保存' },
  dirty: { color: 'warning', text: '未保存' },
  saving: { color: 'processing', text: '保存中...' },
  conflict: { color: 'error', text: '版本冲突' },
  invalid: { color: 'error', text: '校验失败' },
  error: { color: 'error', text: '保存失败' },
};

export default function Editor() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storedProjectId = useAppStore((state) => state.currentProjectId);
  const storedScenarioId = useAppStore((state) => state.currentScenarioId);
  const setProjectContext = useAppStore((state) => state.setProjectContext);
  const projectId = searchParams.get('projectId') ?? storedProjectId;
  const scenarioId = searchParams.get('scenarioId') ?? storedScenarioId;

  // ===== 领域 API 接入 =====
  const { data: serverData, isLoading, isError } = useScenario(scenarioId ?? '');
  const saveMutation = useSaveScenario(scenarioId ?? '');
  const autoLayoutMutation = useAutoLayoutScenario(scenarioId ?? '');
  const [creatingSimulation, setCreatingSimulation] = useState(false);

  const [components, setComponents] = useState<SceneComponent[]>(initialComponents);
  // 历史栈：past 是可 undo 的快照，future 是可 redo 的快照
  const [past, setPast] = useState<SceneComponent[][]>([]);
  const [future, setFuture] = useState<SceneComponent[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>('shelf-A1');
  const [tool, setTool] = useState<string>('select');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [zoom, setZoom] = useState(100);
  const [scenarioVersion, setScenarioVersion] = useState<number | null>(null);
  const [scenarioCanvas, setScenarioCanvas] = useState<ScenarioData['canvas']>({ width: 1200, height: 800, scale: 1 });
  const [logs, setLogs] = useState(editorOperationLogs);
  const lastLoadedAtRef = useRef<number>(0);

  useEffect(() => {
    if (projectId || scenarioId) {
      setProjectContext({ projectId: projectId ?? undefined, scenarioId: scenarioId ?? undefined });
    }
  }, [projectId, scenarioId, setProjectContext]);

  useEffect(() => {
    if (!serverData) return;
    setComponents(serverData.data.components);
    setSelectedId(serverData.data.components[0]?.id ?? null);
    setScenarioVersion(serverData.version);
    setScenarioCanvas(serverData.data.canvas);
    setPast([]);
    setFuture([]);
    setSaveStatus('saved');
    lastLoadedAtRef.current = Date.now();
  }, [serverData]);

  const selected = components.find((c) => c.id === selectedId) ?? null;

  const groupedLib = useMemo(() => {
    const groups: Record<string, typeof editorComponentLibrary> = {};
    editorComponentLibrary.forEach((c) => {
      if (!groups[c.category]) groups[c.category] = [];
      groups[c.category].push(c);
    });
    return groups;
  }, []);

  // 推入历史栈（在修改前调用）
  const pushHistory = useCallback((prev: SceneComponent[]) => {
    setPast((p) => {
      const next = [...p, prev];
      if (next.length > HISTORY_LIMIT) next.shift();
      return next;
    });
    setFuture([]);
  }, []);

  const updateComponent = (id: string, patch: Partial<SceneComponent>) => {
    setComponents((cs) => {
      pushHistory(cs);
      return cs.map((c) => (c.id === id ? { ...c, ...patch } : c));
    });
    setSaveStatus('dirty');
  };

  const undo = useCallback(() => {
    if (past.length === 0) {
      message.info('没有可撤销的操作');
      return;
    }
    setPast((p) => {
      const last = p[p.length - 1];
      setFuture((f) => [components, ...f]);
      setComponents(last);
      return p.slice(0, -1);
    });
    setSaveStatus('dirty');
    addLogInternal('你', '撤销');
  }, [past, components, message]);

  const redo = useCallback(() => {
    if (future.length === 0) {
      message.info('没有可重做的操作');
      return;
    }
    setFuture((f) => {
      const next = f[0];
      setPast((p) => [...p, components]);
      setComponents(next);
      return f.slice(1);
    });
    setSaveStatus('dirty');
    addLogInternal('你', '重做');
  }, [future, components, message]);

  // 对齐辅助
  const alignSelected = useCallback((axis: 'left' | 'right' | 'center-h' | 'top' | 'bottom' | 'center-v') => {
    if (!selectedId) {
      message.warning('请先选中一个组件');
      return;
    }
    setComponents((cs) => {
      pushHistory(cs);
      const idx = cs.findIndex((c) => c.id === selectedId);
      if (idx < 0) return cs;
      const sel = cs[idx];
      const canvasW = 1200;
      const canvasH = 700;
      let patch: Partial<SceneComponent> = {};
      switch (axis) {
        case 'left': patch = { x: 0 }; break;
        case 'right': patch = { x: canvasW - sel.width }; break;
        case 'center-h': patch = { x: Math.round((canvasW - sel.width) / 2) }; break;
        case 'top': patch = { y: 0 }; break;
        case 'bottom': patch = { y: canvasH - sel.height }; break;
        case 'center-v': patch = { y: Math.round((canvasH - sel.height) / 2) }; break;
      }
      return cs.map((c) => (c.id === selectedId ? { ...c, ...patch } : c));
    });
    setSaveStatus('dirty');
    addLogInternal('你', '对齐', selected?.name, axis);
  }, [selectedId, selected, message, pushHistory]);

  const addLogInternal = (user: string, action: string, target?: string, details?: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setLogs((prev) => [{ time, user, action, target, details }, ...prev].slice(0, 30));
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setTool('select');
  };

  const handleDelete = (id: string) => {
    const c = components.find((x) => x.id === id);
    if (!c) return;
    setComponents((cs) => {
      pushHistory(cs);
      return cs.filter((x) => x.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
    setSaveStatus('dirty');
    addLogInternal('你', '删除', c.name);
    message.success(`已删除 ${c.name}`);
  };

  const handleRotate = (id: string) => {
    const c = components.find((x) => x.id === id);
    if (!c) return;
    const newRot = (c.rotation + 90) % 360;
    updateComponent(id, { rotation: newRot });
    addLogInternal('你', '旋转', c.name, `${newRot}°`);
  };

  const handleDragStart = (e: React.MouseEvent, id: string) => {
    if (tool !== 'drag') return;
    e.preventDefault();
    e.stopPropagation();
    const c = components.find((x) => x.id === id);
    if (!c) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startCx = c.x;
    const startCy = c.y;
    const scale = zoom / 100;
    let historyPushed = false;
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      setComponents((cs) => {
        if (!historyPushed) {
          pushHistory(cs);
          historyPushed = true;
        }
        return cs.map((x) => (x.id === id ? { ...x, x: Math.max(0, Math.round(startCx + dx)), y: Math.max(0, Math.round(startCy + dy)) } : x));
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      addLogInternal('你', '移动', c.name, `→ (${c.x}, ${c.y})`);
      setSaveStatus('dirty');
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSave = () => {
    if (!scenarioId) {
      message.warning('缺少场景 ID，请从首页创建或应用模板后再保存');
      return;
    }
    setSaveStatus('saving');
    saveMutation.mutate({ components, canvas: scenarioCanvas, expectedVersion: scenarioVersion ?? undefined }, {
      onSuccess: (saved) => {
        setScenarioVersion(saved.version);
        setSaveStatus('saved');
        addLogInternal('你', '保存草稿', `${components.length} 个组件`, saved.updated_at);
        message.success(`草稿已保存为版本 v${saved.version}`);
      },
      onError: (error) => {
        if (error instanceof ScenarioConflictError) {
          setSaveStatus('conflict');
          message.warning('检测到版本冲突，请重新加载最新场景后再保存');
        } else if (error instanceof ScenarioValidationError) {
          setSaveStatus('invalid');
          message.error(error.message);
        } else {
          setSaveStatus('error');
          message.error('保存失败，请检查后端服务后重试');
        }
      },
    });
  };

  const handleReload = () => {
    if (!scenarioId) {
      message.warning('缺少场景 ID，无法从服务器重新加载');
      return;
    }
    if (isError) {
      message.error('场景加载失败，请检查后端服务后重试');
      return;
    }

    const applyServerData = () => {
      if (!serverData) return;
      setComponents(serverData.data.components);
      setSelectedId(serverData.data.components[0]?.id ?? null);
      setScenarioVersion(serverData.version);
      setScenarioCanvas(serverData.data.canvas);
      setSaveStatus('saved');
      setPast([]);
      setFuture([]);
      addLogInternal('系统', '从服务器重新加载', `v${serverData.version}`);
      message.success(`已加载服务器版本 v${serverData.version}`);
    };

    if (saveStatus !== 'saved') {
      Modal.confirm({
        title: '放弃未保存的修改？',
        content: '当前修改、冲突或校验状态将被服务器版本覆盖。',
        okText: '放弃并重新加载',
        cancelText: '取消',
        onOk: applyServerData,
      });
    } else if (serverData) {
      applyServerData();
    } else {
      message.info(isLoading ? '场景仍在加载中' : '服务器没有可加载的场景数据');
    }
  };

  const handleAutoLayout = () => {
    if (!scenarioId) {
      message.warning('缺少场景 ID，无法执行自动布局');
      return;
    }
    autoLayoutMutation.mutate({ components, canvas: scenarioCanvas }, {
      onSuccess: (result) => {
        pushHistory(components);
        setComponents(result.data.components);
        setScenarioCanvas(result.data.canvas);
        setSelectedId(result.data.components[0]?.id ?? null);
        setSaveStatus('dirty');
        addLogInternal('系统', '后端自动布局', `${result.data.components.length} 个组件`);
        message.success('布局已由后端生成，请保存草稿');
      },
      onError: (error) => {
        message.error(error instanceof Error ? error.message : '自动布局失败');
      },
    });
  };

  const handleEnterSim = async () => {
    if (!projectId || !scenarioId) {
      message.warning('缺少项目或场景 ID，无法创建真实仿真');
      return;
    }
    if (saveStatus !== 'saved') {
      message.warning('请先保存草稿');
      return;
    }
    setCreatingSimulation(true);
    try {
      const run = await createSimulation({ project_id: projectId, scenario_id: scenarioId, robot_count: 10, order_count: 20 });
      setProjectContext({ projectId, scenarioId, simulationId: run.id });
      message.success('已创建 10 台 AGV、20 个订单的真实仿真');
      navigate(`/simulation?projectId=${projectId}&scenarioId=${scenarioId}&simulationId=${run.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建仿真失败，请重试');
    } finally {
      setCreatingSimulation(false);
    }
  };

  const handleAddComponent = (category: string, name: string) => {
    const newId = `${category}-${Date.now()}`;
    const offset = (components.length % 5) * 30;
    const newComp: SceneComponent = {
      id: newId,
      type: category as SceneComponent['type'],
      name: `${name} #${components.length + 1}`,
      x: 100 + offset,
      y: 100 + offset,
      width: category === 'shelf' ? 240 : category === 'agv' ? 24 : 40,
      height: category === 'shelf' ? 80 : category === 'agv' ? 16 : 40,
      rotation: 0,
      properties: {},
    };
    setComponents((cs) => {
      pushHistory(cs);
      return [...cs, newComp];
    });
    setSelectedId(newId);
    setSaveStatus('dirty');
    addLogInternal('你', '添加', newComp.name);
    message.success(`已添加 ${newComp.name}`);
  };

  // 键盘快捷键：Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="editor-page">
      <div className="editor-header">
        <div className="editor-header-left">
          <h1 className="editor-title">
            场景编辑器 / 仓库建模
            <span className="version-tag">v{scenarioVersion ?? "—"}</span>
            <Tag color={saveStatusMeta[saveStatus].color} className="save-tag">
              {saveStatusMeta[saveStatus].text}
            </Tag>
            {selected && <Tag color="blue" className="save-tag">已选中: {selected.name}</Tag>}
            {!scenarioId && <Tag color="warning" className="save-tag">未绑定场景</Tag>}
            {isLoading && <Tag color="processing" className="save-tag">正在加载场景</Tag>}
            {isError && <Tag color="error" className="save-tag">场景加载失败</Tag>}
          </h1>
        </div>
        <div className="editor-header-right">
          <Button.Group>
            <Button icon={<UndoOutlined />} onClick={undo} disabled={past.length === 0} title="撤销 (Ctrl+Z)">撤销</Button>
            <Button icon={<RedoOutlined />} onClick={redo} disabled={future.length === 0} title="重做 (Ctrl+Y)">重做</Button>
          </Button.Group>
          <Button icon={<ReloadOutlined />} onClick={handleReload}>重新加载</Button>
          <Button icon={<ThunderboltOutlined />} onClick={handleAutoLayout} loading={autoLayoutMutation.isPending}>自动生成布局</Button>
          <Button icon={<SaveOutlined />} onClick={handleSave} loading={saveStatus === 'saving'}>保存草稿</Button>
          <Button type="primary" icon={<PlayCircleOutlined />} loading={creatingSimulation} onClick={handleEnterSim}>进入仿真</Button>
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-lib">
          <div className="lib-search">
            <Input placeholder="搜索组件" prefix={<span>🔍</span>} allowClear />
          </div>
          <div className="lib-list">
            {Object.entries(groupedLib).map(([cat, items]) => {
              const labelMap: Record<string, string> = {
                shelf: '货架', agv: 'AGV', arm: '机械臂', conveyor: '传送带', station: '工作站', charger: '充电桩', obstacle: '围栏/障碍物',
              };
              return (
                <div key={cat} className="lib-group">
                  <div className="lib-group-title">
                    {labelMap[cat] ?? cat}
                  </div>
                  {items.map((c) => (
                    <div
                      key={c.name}
                      className="lib-item"
                      onClick={() => handleAddComponent(c.category, c.name)}
                      style={{ cursor: 'pointer' }}
                      title={`点击添加到画布`}
                    >
                      <div className="lib-item-icon" style={{ background: `${c.iconColor}18`, color: c.iconColor }}>
                        {c.category === 'shelf' && '🗄️'}
                        {c.category === 'agv' && '🤖'}
                        {c.category === 'arm' && '🦾'}
                        {c.category === 'conveyor' && '➰'}
                        {c.category === 'station' && '📍'}
                        {c.category === 'charger' && '⚡'}
                        {c.category === 'obstacle' && '🧱'}
                      </div>
                      <div className="lib-item-body">
                        <div className="lib-item-name">{c.name}</div>
                        <div className="lib-item-spec">{c.spec}</div>
                        <div className="lib-item-count">数量：{c.count}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            <Button type="dashed" block icon={<span>+</span>} className="lib-add-btn">
              添加自定义组件
            </Button>
          </div>
          <div className="lib-footer">
            {tool === 'select' ? '👆 单击组件可选中 / 删除' : tool === 'drag' ? '✋ 拖拽组件可移动位置' : `工具：${tool}`}
          </div>
        </div>

        <div className="editor-canvas-wrap">
          <div className="canvas-toolbar">
            {editorTools.map((t) => (
              <Button
                key={t.key}
                size="small"
                type={tool === t.key ? 'primary' : 'default'}
                icon={toolIconMap[t.icon]}
                title={t.label}
                onClick={() => {
                  setTool(t.key);
                  if (t.key === 'delete' && selectedId) handleDelete(selectedId);
                }}
              >
                {t.label}
              </Button>
            ))}
            {selectedId && (
              <>
                <Button size="small" onClick={() => handleRotate(selectedId)} icon={<ReloadOutlined />}>旋转</Button>
                <Button size="small" danger onClick={() => handleDelete(selectedId)} icon={<DeleteOutlined />}>删除</Button>
              </>
            )}
            <Dropdown
              menu={{
                items: [
                  { key: 'left', label: '左对齐', onClick: () => alignSelected('left') },
                  { key: 'right', label: '右对齐', onClick: () => alignSelected('right') },
                  { key: 'center-h', label: '水平居中', onClick: () => alignSelected('center-h') },
                  { type: 'divider' as const },
                  { key: 'top', label: '顶部对齐', onClick: () => alignSelected('top') },
                  { key: 'bottom', label: '底部对齐', onClick: () => alignSelected('bottom') },
                  { key: 'center-v', label: '垂直居中', onClick: () => alignSelected('center-v') },
                ],
              }}
            >
              <Button size="small" icon={<AlignCenterOutlined />}>对齐</Button>
            </Dropdown>
          </div>
          <div className="editor-canvas">
            <div className="canvas-grid" style={{ transform: `scale(${zoom / 100})`, transformOrigin: '0 0' }}>
              {components.map((c) => (
                <div
                  key={c.id}
                  className={`canvas-component ${selectedId === c.id ? 'selected' : ''}`}
                  style={{
                    left: c.x,
                    top: c.y,
                    width: c.width,
                    height: c.height,
                    background: `${colorMap[c.type]}30`,
                    border: `2px solid ${selectedId === c.id ? '#2b6fff' : colorMap[c.type]}`,
                    color: colorMap[c.type],
                    transform: `rotate(${c.rotation}deg)`,
                    cursor: tool === 'drag' ? 'move' : 'pointer',
                  }}
                  onClick={(e) => { e.stopPropagation(); handleSelect(c.id); }}
                  onMouseDown={(e) => handleDragStart(e, c.id)}
                >
                  {c.name}
                </div>
              ))}
              <div className="zone-label" style={{ left: 200, top: 200, color: '#3b82f6' }}>A 区</div>
              <div className="zone-label" style={{ left: 760, top: 200, color: '#22c55e' }}>B 区</div>
              <div className="zone-label" style={{ left: 200, top: 460, color: '#f59e0b' }}>C 区</div>
              <div className="zone-label" style={{ left: 760, top: 460, color: '#a855f7' }}>D 区</div>
              <div className="door-label" style={{ left: 200, top: 30, color: '#94a3b8' }}>出货口 01</div>
              <div className="door-label" style={{ left: 360, top: 30, color: '#94a3b8' }}>出货口 02</div>
              <div className="door-label" style={{ left: 800, top: 30, color: '#94a3b8' }}>收货口 01</div>
              <div className="door-label" style={{ left: 960, top: 30, color: '#94a3b8' }}>收货口 02</div>
              <div className="door-label" style={{ left: 480, top: 600, color: '#94a3b8' }}>充电区</div>
            </div>
          </div>
          <div className="canvas-bottom">
            <div className="canvas-zoom">
              <Button size="small" onClick={() => setZoom((z) => Math.max(50, z - 10))} icon={<ZoomOutOutlined />}>-</Button>
              <span className="zoom-text num-font">{zoom}%</span>
              <Button size="small" onClick={() => setZoom((z) => Math.min(200, z + 10))} icon={<ZoomInOutlined />}>+</Button>
            </div>
            <div className="canvas-scale">0    10    20    30m</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              组件 {components.length} 个 · 选中 {selectedId ? 1 : 0} 个 · 撤销栈 {past.length}/{HISTORY_LIMIT} · Ctrl+Z 撤销 / Ctrl+Y 重做
            </div>
          </div>
        </div>

        <div className="editor-aside">
          <SectionCard
            title={selected ? `属性：${selected.name}` : '属性配置'}
            extra={<span className="aside-id">ID: {selected?.id ?? '—'}</span>}
            bodyHeight={420}
          >
            <Tabs
              defaultActiveKey="props"
              size="small"
              items={[
                { key: 'props', label: '属性' },
                { key: 'style', label: '样式' },
              ]}
            />
            {selected ? (
              <div className="prop-list">
                <div className="prop-row">
                  <div className="prop-label">名称</div>
                  <div className="prop-value">
                    <Input size="small" value={selected.name} onChange={(e) => updateComponent(selected.id, { name: e.target.value })} />
                  </div>
                </div>
                <PropRow label="类型" value={selected.type} />
                <div className="prop-row">
                  <div className="prop-label">坐标 (m)</div>
                  <div className="prop-value">
                    <InputNumber size="small" value={selected.x} onChange={(v) => v !== null && updateComponent(selected.id, { x: v })} addonBefore="X" style={{ width: 90 }} />
                    <InputNumber size="small" value={selected.y} onChange={(v) => v !== null && updateComponent(selected.id, { y: v })} addonBefore="Y" style={{ width: 90, marginLeft: 6 }} />
                  </div>
                </div>
                <div className="prop-row">
                  <div className="prop-label">尺寸 (m)</div>
                  <div className="prop-value">
                    <InputNumber size="small" value={selected.width} onChange={(v) => v !== null && updateComponent(selected.id, { width: v })} addonBefore="宽" style={{ width: 90 }} />
                    <InputNumber size="small" value={selected.height} onChange={(v) => v !== null && updateComponent(selected.id, { height: v })} addonBefore="高" style={{ width: 90, marginLeft: 6 }} />
                  </div>
                </div>
                <div className="prop-row">
                  <div className="prop-label">朝向</div>
                  <div className="prop-value">
                    <InputNumber size="small" value={selected.rotation} onChange={(v) => v !== null && updateComponent(selected.id, { rotation: v })} addonAfter="°" style={{ width: 110 }} />
                  </div>
                </div>
                {selected.type === 'shelf' && (
                  <div className="prop-row">
                    <div className="prop-label">容量</div>
                    <div className="prop-value">
                      <InputNumber size="small" value={Number(selected.properties.capacity ?? 200)} onChange={(v) => v !== null && updateComponent(selected.id, { properties: { ...selected.properties, capacity: v } })} addonAfter="托/层" style={{ width: 130 }} />
                    </div>
                  </div>
                )}
                {selected.type === 'agv' && (
                  <div className="prop-row">
                    <div className="prop-label">电量</div>
                    <div className="prop-value">
                      <InputNumber size="small" min={0} max={100} value={Number(selected.properties.battery ?? 80)} onChange={(v) => v !== null && updateComponent(selected.id, { properties: { ...selected.properties, battery: v } })} addonAfter="%" style={{ width: 130 }} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0', fontSize: 13 }}>
                请在画布中选择一个组件
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="场景规则"
            extra={<a>编辑规则</a>}
            bodyHeight={200}
          >
            <div className="rule-list">
              <div className="rule-row">
                <span className="rule-label">通行方向</span>
                <Select size="small" defaultValue={editorSceneRules.direction} style={{ width: 140 }} options={[{ value: '双向通行', label: '双向通行' }]} />
              </div>
              <div className="rule-row">
                <span className="rule-label">速度限制</span>
                <InputNumber size="small" defaultValue={editorSceneRules.speedLimit} addonAfter="m/s" style={{ width: 140 }} />
              </div>
              <div className="rule-row">
                <span className="rule-label">禁行区域</span>
                <span className="rule-value">{editorSceneRules.forbiddenZones} 处区域</span>
              </div>
              <div className="rule-row">
                <span className="rule-label">设备安全边界</span>
                <Tag color={editorSceneRules.safetyBoundary === '已启用' ? 'success' : 'default'}>{editorSceneRules.safetyBoundary}</Tag>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="editor-bottom">
        <SectionCard title="场景概览">
          <div className="overview-grid">
            <OverviewItem label="货架数量" value={components.filter((c) => c.type === 'shelf').length} unit="个" subLabel={`占地面积 ${editorOverview.shelvesArea} m²`} />
            <OverviewItem label="AGV 数量" value={components.filter((c) => c.type === 'agv').length} unit="台" subLabel={`在线 ${components.filter((c) => c.type === 'agv').length - 0} | 离线 0`} />
            <OverviewItem label="机械臂数量" value={components.filter((c) => c.type === 'arm').length} unit="台" subLabel={`工作站 ${components.filter((c) => c.type === 'station').length} 个`} />
            <OverviewItem label="工作站数量" value={components.filter((c) => c.type === 'station').length} unit="个" subLabel="拣选 + 包装" />
            <OverviewItem label="总面积" value={editorOverview.totalArea} unit="m²" subLabel={editorOverview.canvasSize} />
            <OverviewItem label="可通行率" value={editorOverview.passableRate} unit="%" subLabel={`可通行面积 ${editorOverview.passableArea} m²`} />
          </div>
        </SectionCard>

        <SectionCard title="操作记录" extra={<a>全部记录</a>} bodyHeight={180}>
          <div className="log-list">
            {logs.map((l, i) => (
              <div key={i} className="log-row">
                <span className="log-time num-font">{l.time}</span>
                <span className="log-user">[{l.user}]</span>
                <span className="log-action">{l.action}</span>
                <span className="log-target">{l.target}</span>
                {l.details && <span className="log-details">({l.details})</span>}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="prop-row">
      <div className="prop-label">{label}</div>
      <div className="prop-value">{value}</div>
    </div>
  );
}

function OverviewItem({ label, value, unit, subLabel }: { label: string; value: string | number; unit?: string; subLabel?: string }) {
  return (
    <div className="overview-item">
      <div className="ov-label">{label}</div>
      <div className="ov-value-row">
        <span className="ov-value num-font">{value}</span>
        {unit && <span className="ov-unit">{unit}</span>}
      </div>
      {subLabel && <div className="ov-sub">{subLabel}</div>}
    </div>
  );
}
