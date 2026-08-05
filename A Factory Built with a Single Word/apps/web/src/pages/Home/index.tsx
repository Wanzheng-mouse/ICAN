import { useRef, useState } from 'react';
import {
  CheckCircleFilled,
  CloudUploadOutlined,
  CodeOutlined,
  CommentOutlined,
  DatabaseOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  LinkOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  RiseOutlined,
  RocketOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  App,
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  Modal,
  Progress,
  Row,
  Space,
  Tag,
  Tooltip,
  Upload,
  type UploadProps,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  useTemplates,
  createProject,
  createScenario,
  getTemplateById,
  applyTemplate,
  uploadProjectFile,
  startRequirementAnalysis,
  waitForRequirementAnalysis,
  analyzeRequirement,
  applyGenerationCandidate,
  generatePlanCandidates,
  createSimulation,
  useDashboardKpis,
} from '@/api/modules';
import type { GenerationCandidateRead, RequirementAnalysisRead } from '@/api/dtos/backend';
import { useAppStore } from '@/stores/useAppStore';
import { useCan } from '@/utils/roleGuard';
import { HeroIllustration, KpiCard } from '@/components';
import {
  generationPipeline,
  homeHero,
  homeTemplatePresets,
  productFeatures,
  requirementPlaceholder,
  uploadSlots,
} from '@/config/productContent';
import { INDUSTRY_EXAMPLES } from '@/utils/generateComponents';
import './index.css';

const iconMap: Record<string, React.ReactNode> = {
  PictureOutlined: <PictureOutlined />,
  FileExcelOutlined: <FileExcelOutlined />,
  CodeOutlined: <CodeOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  CommentOutlined: <CommentOutlined />,
  TeamOutlined: <TeamOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  RiseOutlined: <RiseOutlined />,
  LinkOutlined: <LinkOutlined />,
};

const templateCoverColors: Record<string, [string, string]> = {
  ecom: ['#dbeafe', '#bfdbfe'],
  coldchain: ['#cffafe', '#a5f3fc'],
  '3c': ['#ede9fe', '#ddd6fe'],
  medical: ['#dcfce7', '#bbf7d0'],
};

/** Backend contracts express confidence and suitability as 0–100 percentages.
 * Accept 0–1 values too so cached records from older builds remain readable. */
function displayPercent(value: number) {
  return Math.round(value <= 1 ? value * 100 : value);
}

const profileLabels: Record<string, string> = {
  industry: '行业',
  warehouse_area_m2: '仓库面积',
  daily_orders: '日均订单量',
  peak_orders_per_hour: '峰值订单量',
  sku_count: 'SKU 数量',
  tote_agv_count: '料箱 AGV',
  pallet_agv_count: '托盘 AGV',
  agv_count: 'AGV / AMR 数量',
  robotic_arm_count: '机械臂',
  pick_station_count: '拣选工位',
  charger_count: '充电桩',
  zones: '规划区域',
  flows: '作业流程',
  objectives: '优化目标',
  device_types: '识别设备',
  sources: '分析资料',
};

function formatProfileValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '未提供';
  if (Array.isArray(value)) return value.length ? value.join(' / ') : '未识别';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== null && nested !== undefined)
      .map(([key, nested]) => `${key}: ${nested}${key.includes('rate') ? '%' : key.includes('seconds') ? '秒' : ''}`);
    return entries.length ? entries.join(' / ') : '未提供';
  }
  return String(value);
}

function _TemplateCover({ cover, name }: { cover: string; name?: string }) {
  const [c1, c2] = templateCoverColors[cover] ?? ['#e2e8f0', '#cbd5e1'];
  return (
    <div
      className="template-cover"
      style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
    >
      <div className="warehouse-mini">
        <div className="wh-shelf" style={{ left: 10, bottom: 18, width: 30, height: 30 }} />
        <div className="wh-shelf" style={{ left: 45, bottom: 18, width: 30, height: 30 }} />
        <div className="wh-shelf" style={{ right: 10, bottom: 18, width: 30, height: 30 }} />
        <div className="wh-agv" style={{ left: 30, bottom: 10 }} />
        <div className="wh-agv" style={{ right: 30, bottom: 10 }} />
        <div className="wh-path" />
        {name && <div className="wh-name">{name}</div>}
      </div>
    </div>
  );
}

export default function Home() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const setProjectContext = useAppStore((s) => s.setProjectContext);
  const canCreate = useCan('edit_scene');
  const [requirement, setRequirement] = useState('');
  const [uploadedSlots, setUploadedSlots] = useState<Record<string, File>>({});
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [showUploads, setShowUploads] = useState(true);
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [analysis, setAnalysis] = useState<RequirementAnalysisRead | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [confirmedAssumptions, setConfirmedAssumptions] = useState<string[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [editingResult, setEditingResult] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [editAssumptions, setEditAssumptions] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<GenerationCandidateRead[]>([]);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [generationProjectId, setGenerationProjectId] = useState<string | null>(null);
  const [selectedProjectId] = useState<string | null>(null);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const operationRef = useRef<string | null>(null);
  const pendingProjectsRef = useRef<Record<string, { requestKey: string; projectId?: string }>>(
    (() => {
      try {
        return JSON.parse(sessionStorage.getItem('ican-pending-project-operations-v1') ?? '{}');
      } catch {
        return {};
      }
    })(),
  );

  const savePendingOperations = () => {
    sessionStorage.setItem(
      'ican-pending-project-operations-v1',
      JSON.stringify(pendingProjectsRef.current),
    );
  };

  const pendingOperation = (operationKey: string) => {
    const existing = pendingProjectsRef.current[operationKey];
    if (existing) return existing;
    const created: { requestKey: string; projectId?: string } = { requestKey: crypto.randomUUID() };
    pendingProjectsRef.current[operationKey] = created;
    savePendingOperations();
    return created;
  };

  const completePendingOperation = (operationKey: string) => {
    delete pendingProjectsRef.current[operationKey];
    savePendingOperations();
  };

  const { data: apiTemplates, isError: templatesError } = useTemplates('scene');
  const { data: kpis } = useDashboardKpis();
  const features = productFeatures;
  const steps = generationPipeline;
  const uploads = uploadSlots;

  const beginOperation = (key: string) => {
    if (operationRef.current) return false;
    operationRef.current = key;
    setActiveOperation(key);
    return true;
  };

  const finishOperation = (key: string) => {
    if (operationRef.current !== key) return;
    operationRef.current = null;
    setActiveOperation(null);
  };

  const handleUpload = (slot: string): UploadProps['customRequest'] => (options) => {
    if (!canCreate) {
      options.onError?.(new Error('当前账号仅有查看权限'));
      return;
    }
    if (!(options.file instanceof File)) {
      options.onError?.(new Error('无法读取文件'));
      return;
    }
    setUploadedSlots((state) => ({ ...state, [slot]: options.file as File }));
    options.onSuccess?.({});
    message.success(`${options.file.name} 已加入项目资料，将在创建项目时保存`);
  };

  const persistUploads = async (projectId: string) => {
    const entries = Object.entries(uploadedSlots);
    if (!entries.length) return;
    const results = await Promise.allSettled(
      entries.map(([slot, file]) => uploadProjectFile(projectId, file, slot)),
    );
    const succeeded = entries.filter((_, index) => results[index].status === 'fulfilled').map(([slot]) => slot);
    if (succeeded.length) {
      setUploadedSlots((state) => {
        const next = { ...state };
        succeeded.forEach((slot) => delete next[slot]);
        return next;
      });
    }
    const failed = results.length - succeeded.length;
    if (failed) message.warning(`${failed} 个资料文件保存失败，可在项目中心重新上传`);
  };

  /* Legacy direct-generation flow retained temporarily for migration reference.
  const handleLegacyGenerate = async () => {
    if (!canCreate) {
      message.warning('当前账号仅有查看权限，不能创建项目');
      return;
    }
    const normalizedRequirement = requirement.trim();
    if (!normalizedRequirement) {
      message.warning('请先输入需求');
      return;
    }
    const operationKey = `generate:${normalizedRequirement}`;
    if (!beginOperation(operationKey)) return;

    setGenerating(true);
    setGenStep(0);
    const pending = pendingOperation(operationKey);
    let projectId = pending.projectId;
    try {
      if (!projectId) {
        const project = await createProject(
          {
            name: normalizedRequirement.slice(0, 40),
            requirement: normalizedRequirement,
          },
          pending.requestKey,
        );
        projectId = project.id;
        pending.projectId = projectId;
        savePendingOperations();
      }
      await persistUploads(projectId);
      // Generate real components from the requirement text — fixes the
      // "empty components" bug that broke the data closed loop.
      const { components, canvas, warnings } = generateComponentsFromRequirement(normalizedRequirement);
      if (warnings.length > 0) {
        message.warning(`部分设备无法放置：${warnings.join('；')}`, 5);
      }
      const scn = await createScenario(
        {
          project_id: projectId,
          name: `${normalizedRequirement.slice(0, 20)}场景`,
          data: {
            components,
            canvas,
            schema_version: '1.0',
          },
        },
        pending.requestKey,
      );
      completePendingOperation(operationKey);
      setProjectContext({ projectId, scenarioId: scn.id });
      const interval = setInterval(() => {
        setGenStep((prev) => {
          if (prev >= 6) {
            clearInterval(interval);
            setGenerating(false);
            finishOperation(operationKey);
            message.success(`方案已创建（项目: ${projectId} / 场景: ${scn.id}）`);
            setTimeout(() => navigate(`/editor?projectId=${projectId}&scenarioId=${scn.id}`), 800);
            return 6;
          }
          return prev + 1;
        });
      }, 500);
    } catch (err: unknown) {
      setGenerating(false);
      finishOperation(operationKey);
      const detail = err instanceof Error ? err.message : '创建失败，请稍后重试';
      message.error(projectId ? `${detail}；项目已保留，再次点击可继续创建场景` : detail);
    }
  };
  */

  const handleGenerate = async () => {
    if (!canCreate) {
      message.warning('当前账号仅有查看权限，不能创建项目');
      return;
    }
    const normalizedRequirement = requirement.trim();
    if (!normalizedRequirement) {
      message.warning('请先输入需求');
      return;
    }
    const operationKey = `analyze:${normalizedRequirement}`;
    if (!beginOperation(operationKey)) return;

    setGenerating(true);
    setGenStep(0);
    try {
      const started = await startRequirementAnalysis({
        requirement: normalizedRequirement,
        project_id: selectedProjectId ?? undefined,
        sources: Object.entries(uploadedSlots).map(([kind, file]) => ({
          kind: (['floorplan', 'orders', 'robot', 'rules'].includes(kind) ? kind : 'other') as 'floorplan' | 'orders' | 'robot' | 'rules' | 'other',
          name: file.name,
        })),
      });
      // Agens analysis runs as a durable backend job. Polling keeps the page
      // responsive and survives a slow model without a browser/proxy timeout.
      const result = await waitForRequirementAnalysis(started.job_id, () => {
        setGenStep(1);
      });
      if (selectedProjectId) setGenerationProjectId(selectedProjectId);
      setAnalysis(result);
      setConfirmedAssumptions([...result.assumptions]);
      setQuestionAnswers({});
      setAnalysisOpen(true);
    } catch (err: unknown) {
      const responseDetail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const detail = typeof responseDetail === 'string'
        ? responseDetail
        : err instanceof Error ? err.message : '需求分析失败，请稍后重试';
      message.error(detail.includes('LLM_ANALYSIS_NOT_CONFIGURED') ? '尚未配置 Agnes API Key：请在后端 services/api/.env 中填写 ICAN_AGNES_API_KEY 后重启服务。' : detail);
    } finally {
      setGenerating(false);
      finishOperation(operationKey);
    }
  };

  const handleEditResult = () => {
    if (!analysis) return;
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(analysis.profile)) {
      fields[k] = Array.isArray(v) ? v.join('、') : v == null ? '' : String(v);
    }
    setEditFields(fields);
    setEditAssumptions([...analysis.assumptions]);
    setEditingResult(true);
  };

  const handleSaveEdit = () => {
    if (!analysis) return;
    const profile: Record<string, unknown> = { ...analysis.profile };
    const nowFilled: string[] = [];
    for (const [k, v] of Object.entries(editFields)) {
      if (['warehouse_area_m2', 'daily_orders', 'peak_orders_per_hour', 'sku_count', 'tote_agv_count', 'pallet_agv_count', 'agv_count', 'robotic_arm_count', 'pick_station_count', 'charger_count'].includes(k)) {
        profile[k] = v ? Number(v) : null;
      } else if (['zones', 'flows', 'objectives'].includes(k)) {
        profile[k] = v ? v.split('、').map((s) => s.trim()).filter(Boolean) : [];
      } else {
        profile[k] = v || null;
      }
      const oldVal = analysis.profile[k];
      const newVal = profile[k];
      const isEmpty = (x: unknown) => x === null || x === undefined || x === '' || (Array.isArray(x) && x.length === 0);
      if (isEmpty(oldVal) && !isEmpty(newVal)) {
        nowFilled.push(k);
      }
    }
    // 已填写字段对应的待确认项自动消除
    const fieldQuestionKeywords: Record<string, string[]> = {
      daily_orders: ['日均订单量', '峰值系数'],
      peak_orders_per_hour: ['日均订单量', '峰值系数'],
      flows: ['作业', '拣选', '出库', '入库'],
      tote_agv_count: ['AGV', 'AMR', '料箱'],
      pallet_agv_count: ['AGV', 'AMR', '托盘'],
      agv_count: ['AGV', 'AMR'],
    };
    const fieldAssumptionKeywords: Record<string, string[]> = {
      daily_orders: ['日均订单量'],
      flows: ['入库', '拣选', '出库'],
      tote_agv_count: ['AGV', '料箱'],
      pallet_agv_count: ['AGV', '托盘'],
      agv_count: ['AGV'],
    };
    const keywords = new Set<string>();
    nowFilled.forEach((f) => (fieldQuestionKeywords[f] ?? []).forEach((kw) => keywords.add(kw)));
    const keptQuestions = analysis.questions.filter((q) => ![...keywords].some((kw) => q.includes(kw)));
    const removedQuestions = analysis.questions.filter((q) => [...keywords].some((kw) => q.includes(kw)));
    // 自动填写已消除问题的答案
    const autoAnswers: Record<string, string> = {};
    removedQuestions.forEach((q) => { autoAnswers[q] = '已通过字段填写完成'; });
    setQuestionAnswers((prev) => ({ ...prev, ...autoAnswers }));
    // 对应假设也标记已确认
    const aKeywords = new Set<string>();
    nowFilled.forEach((f) => (fieldAssumptionKeywords[f] ?? []).forEach((kw) => aKeywords.add(kw)));
    const keptAssumptions = analysis.assumptions.filter((a) => ![...aKeywords].some((kw) => a.includes(kw)));
    setConfirmedAssumptions((prev) => prev.filter((a) => keptAssumptions.includes(a)));
    setAnalysis({ ...analysis, profile, assumptions: keptAssumptions, questions: keptQuestions });
    setEditingResult(false);
    message.success('分析结果已更新，已填字段对应的待确认项已自动消除');
  };

  const handleGenerateCandidates = async () => {
    if (!analysis) return;
    if (analysis.questions.some((q) => !questionAnswers[q]?.trim())) {
      message.warning('请回答所有待确认项后再生成方案');
      return;
    }
    const operationKey = `candidates:${analysis.job_id}`;
    if (!beginOperation(operationKey)) return;
    const pending = pendingOperation(operationKey);
    let projectId = generationProjectId ?? pending.projectId;
    setGenerating(true);
    setGenStep(2);
    try {
      // 先用补充后的 profile 重新分析，让 candidate_guidance 反映完整信息
      const enrichedReq = requirement + '\n\n' +
        Object.entries(analysis.profile)
          .filter(([_, v]) => v != null && !(Array.isArray(v) && v.length === 0))
          .map(([k, v]) => Array.isArray(v) ? `${k}: ${v.join('、')}` : `${k}: ${v}`)
          .join('\n');
      const freshAnalysis = await analyzeRequirement({
        requirement: enrichedReq,
        sources: [],
      });
      setAnalysis(freshAnalysis);
      setConfirmedAssumptions(freshAnalysis.assumptions.filter(
        (a) => confirmedAssumptions.includes(a),
      ));
      // 项目创建
      if (!projectId) {
        const project = await createProject(
          { name: requirement.trim().slice(0, 40), requirement: requirement.trim() },
        );
        projectId = project.id;
        pending.projectId = project.id;
        setGenerationProjectId(project.id);
        savePendingOperations();
      }
      await persistUploads(projectId);
      setGenStep(3);
      const result = await generatePlanCandidates({
        job_id: freshAnalysis.job_id,
        profile: analysis.profile,
        assumptions: confirmedAssumptions,
        questions: questionAnswers,
      });
      setCandidates(result.candidates);
      setAnalysisOpen(false);
      setCandidateOpen(true);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '候选方案生成失败，请稍后重试');
    } finally {
      setGenerating(false);
      finishOperation(operationKey);
    }
  };

  const handleSelectCandidate = async (candidate: GenerationCandidateRead) => {
    if (!generationProjectId) {
      message.error('项目尚未创建，请重新生成候选方案');
      return;
    }
    const operationKey = `select-candidate:${candidate.id}`;
    if (!beginOperation(operationKey)) return;
    setGenerating(true);
    setGenStep(4);
    try {
      const scn = analysis
        ? await applyGenerationCandidate(
            analysis.job_id,
            candidate.id,
            generationProjectId,
            `${candidate.title}场景`,
          )
        : await createScenario(
            { project_id: generationProjectId, name: `${candidate.title}场景`, data: candidate.data },
          );
      completePendingOperation(`candidates:${analysis?.job_id}`);
      setProjectContext({ projectId: generationProjectId, scenarioId: scn.id });
      setCandidateOpen(false);
      message.success('方案已保存，可继续在编辑器中调整');
      navigate(`/editor?projectId=${generationProjectId}&scenarioId=${scn.id}`);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存方案失败，请重试');
    } finally {
      setGenerating(false);
      finishOperation(operationKey);
    }
  };

  const handleUseExample = () => {
    setShowExampleModal(true);
  };

  const handleSelectExample = (example: typeof INDUSTRY_EXAMPLES[number]) => {
    setRequirement(example.requirement);
    setShowExampleModal(false);
    message.info(`已填入「${example.name}」示例需求，点击开始生成即可创建场景`);
  };

  const handleTemplateAction = async (
    templateId: string,
    tplTitle: string,
    action: 'preview' | 'use' | 'quick',
  ) => {
    if (action !== 'preview' && !canCreate) {
      message.warning('当前账号仅有查看权限，不能套用模板');
      return;
    }
    const operationKey = `${action}:${templateId}`;
    if (!beginOperation(operationKey)) return;
    const pending = action === 'preview' ? undefined : pendingOperation(operationKey);
    let projectId = pending?.projectId;
    try {
      if (action === 'preview') {
        const detail = await getTemplateById(templateId);
        if (!detail) throw new Error('模板不存在或已下架');
        message.info(`「${tplTitle}」包含 ${detail.data.components.length} 个场景组件`);
        return;
      }

      const projectName = action === 'quick' ? `快速体验-${tplTitle}` : tplTitle;
      if (!projectId) {
        const project = await createProject({
          name: projectName,
          requirement: `${action === 'quick' ? '快速体验' : '使用模板'} ${tplTitle}`,
        });
        projectId = project.id;
        if (pending) {
          pending.projectId = projectId;
          savePendingOperations();
        }
      }
      await persistUploads(projectId);
      const scn = await applyTemplate(templateId, {
        project_id: projectId,
        name: `${tplTitle}场景`,
      });
      completePendingOperation(operationKey);
      setProjectContext({ projectId, scenarioId: scn.id });

      if (action === 'use') {
        message.success(`已从「${tplTitle}」创建场景，跳转编辑器`);
        setTimeout(() => navigate(`/editor?projectId=${projectId}&scenarioId=${scn.id}`), 600);
      } else {
        message.success('快速体验场景已创建');
        const robotCount = Math.max(1, scn.data.components.filter((component) => component.type === 'agv').length || 8);
        const simulation = await createSimulation({
          project_id: projectId,
          scenario_id: scn.id,
          robot_count: robotCount,
          order_count: Math.max(20, robotCount * 5),
          random_seed: Date.now() % 100000,
        });
        setProjectContext({ projectId, scenarioId: scn.id, simulationId: simulation.id });
        setTimeout(() => navigate(`/simulation?projectId=${projectId}&scenarioId=${scn.id}&simulationId=${simulation.id}`), 800);
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : '操作失败，请稍后重试';
      message.error(projectId ? `${detail}；项目已保留，请重试当前操作` : detail);
    } finally {
      finishOperation(operationKey);
    }
  };

  return (
    <div className="page-container home-page">
      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="grid-overlay" aria-hidden="true" />
        <div className="hero-signal hero-signal-one" aria-hidden="true" />
        <div className="hero-signal hero-signal-two" aria-hidden="true" />
        <div className="hero-text">
          <h1 className="hero-title">{homeHero.title}</h1>
          <p className="hero-subtitle">{homeHero.subtitle}</p>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{homeTemplatePresets.length}</span>
              <span className="hero-stat-label">行业场景模板</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{steps.length}</span>
              <span className="hero-stat-label">智能生成步骤</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{features.length}</span>
              <span className="hero-stat-label">核心能力模块</span>
            </div>
          </div>
        </div>
        <div className="hero-image">
          <HeroIllustration variant="isometric" height={260} />
        </div>
      </div>

      {/* 真实后端 KPI 概览 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { key: 'projects', title: '项目总数', value: kpis?.projects ?? 0, color: '#2b6fff' },
          { key: 'scenarios', title: '场景总数', value: kpis?.scenarios ?? 0, color: '#8b5cf6' },
          { key: 'simulations', title: '仿真运行', value: kpis?.simulations ?? 0, color: '#22c55e' },
          {
            key: 'completion',
            title: '平均完成率',
            value: kpis ? `${Math.round((kpis.average_completion_rate ?? 0) * 100)}%` : '--',
            color: '#f59e0b',
          },
        ].map((item) => (
          <Col xs={12} md={6} key={item.key}>
            <KpiCard
              size="small"
              showDelta={false}
              data={{ title: item.title, value: item.value, iconColor: item.color }}
            />
          </Col>
        ))}
      </Row>

      {/* 主要内容区 */}
      <div className="home-grid">
        <div className="home-main">
          {!canCreate && (
            <Alert
              type="info"
              showIcon
              message="当前为只读模式"
              description="你可以浏览模板和已有项目，但不能创建项目、上传资料或套用模板。"
              style={{ marginBottom: 16 }}
            />
          )}
          {/* 需求输入 — 对齐 Front-images：纯输入卡 + 双按钮 */}
          <div className="section-card">
            <div className="section-title">
              <span className="icon">{iconMap.CommentOutlined}</span>
              请输入需求
            </div>
            <div className="requirement-input-wrap">
              <Input.TextArea
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder={requirementPlaceholder}
                maxLength={500}
                showCount={{ formatter: ({ count }) => `${count}/500` }}
                autoSize={{ minRows: 4, maxRows: 8 }}
                className="requirement-input"
                disabled={!canCreate || generating || Boolean(activeOperation)}
              />
              <div className="requirement-actions">
                <Button
                  type="primary"
                  size="large"
                  icon={<RocketOutlined />}
                  onClick={handleGenerate}
                  loading={generating}
                  disabled={!canCreate || (Boolean(activeOperation) && !generating)}
                >
                  {generating ? '生成中...' : '开始生成'}
                </Button>
                <Button
                  size="large"
                  icon={<FileTextOutlined />}
                  onClick={handleUseExample}
                  disabled={!canCreate || Boolean(activeOperation)}
                >
                  查看示例
                </Button>
              </div>
              {generating && (
                <div className="req-progress">
                  <div className="req-progress-label">
                    {[
                      '正在分析需求、资料和约束条件',
                      '正在等待分析完成',
                      '正在基于补充信息重新分析',
                      '正在生成候选方案',
                      '正在保存并构建场景',
                    ][genStep] ?? '处理中...'}
                  </div>
                  <Progress
                    percent={[25, 50, 62, 78, 92][genStep] ?? 25}
                    showInfo={false}
                    strokeColor={{ from: '#3568ff', to: '#3bb6f5' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 4 个文件上传（默认展开，与 Front-images 对齐） */}
          <div className="section-card">
            <div
              className="section-title flex-between"
              style={{ marginBottom: 16, cursor: 'pointer' }}
              onClick={() => setShowUploads(!showUploads)}
            >
              <span>
                <span className="icon">{iconMap.FileTextOutlined}</span>
                补充资料{' '}
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
                  （{showUploads ? '点击收起' : '点击展开，非必填'}）
                </span>
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {Object.keys(uploadedSlots).length} / {uploads.length} 已上传
                <span style={{ marginLeft: 8 }}>{showUploads ? '▲' : '▼'}</span>
              </span>
            </div>
            {showUploads && (
              <div className="upload-grid">
                {uploads.map((item) => (
                  <div
                    key={item.slot}
                    className={`upload-card ${uploadedSlots[item.slot] ? 'uploaded' : ''}`}
                  >
                    <div
                      className="upload-card-icon"
                      style={{ background: `${item.iconColor}18`, color: item.iconColor }}
                    >
                      {iconMap[item.iconName]}
                    </div>
                    <div className="upload-card-body">
                      <div className="upload-card-title">{item.title}</div>
                      <div className="upload-card-desc">{item.description}</div>
                      <Upload
                        accept={item.accept}
                        customRequest={handleUpload(item.slot)}
                        showUploadList={false}
                        maxCount={1}
                        disabled={!canCreate}
                      >
                        <Button
                          type="default"
                          icon={<CloudUploadOutlined />}
                          className="upload-btn"
                        >
                          {uploadedSlots[item.slot] ? '待保存 · 重新选择' : '选择文件'}
                        </Button>
                      </Upload>
                    </div>
                    {uploadedSlots[item.slot] && (
                      <CheckCircleFilled
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          color: '#22c55e',
                          fontSize: 18,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 热门场景模板 */}
          <div className="section-card">
            <div className="section-title flex-between" style={{ marginBottom: 16 }}>
              <span>
                <span className="icon">🔥</span>
                热门场景模板
              </span>
              <a className="more-link" onClick={() => navigate('/resource')}>
                查看更多模板 →
              </a>
            </div>
            <div className="template-grid">
              {templatesError ? (
                <Alert
                  type="error"
                  showIcon
                  message="场景模板加载失败"
                  description="已根据预设展示推荐模板，仍可继续使用「开始生成」。"
                  style={{ gridColumn: '1 / -1' }}
                />
              ) : null}
              {/* 热门模板 — 对齐 Front-images/image01：固定展示 4 类（电商中型仓/冷链多温区仓/3C高错订/医药仓） */}
              {homeTemplatePresets.map((preset) => {
                const matched = apiTemplates?.find((tpl) => ((tpl as { cover?: string }).cover ?? '') === preset.key);
                const templateId = matched ? matched.id : `preset-${preset.key}`;
                return (
                  <div key={preset.key} className="template-card-item">
                    <HeroIllustration variant={preset.key} height={110} />
                    <div className="template-card-body">
                      <div className="template-card-title">{preset.title}</div>
                      <div className="template-card-desc">{preset.description}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          loading={activeOperation === `quick:${templateId}`}
                          disabled={!canCreate || Boolean(activeOperation) || generating}
                          onClick={() => {
                            if (matched) {
                              void handleTemplateAction(matched.id, preset.title, 'quick');
                            } else {
                              const example = INDUSTRY_EXAMPLES.find((e) => e.cover === preset.key);
                              if (example) handleSelectExample(example);
                              else message.info(`「${preset.title}」演示模板即将就绪`);
                            }
                          }}
                        >
                          快捷体验
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右侧 7 步流程（对齐 Front-images：编号圆+连接线） */}
        <div className="home-aside">
          <div className="section-card flow-card">
            <div className="section-title">生成流程预览</div>
            <div className="flow-list">
              {steps.map((s) => (
                <div
                  key={s.index}
                  className={`flow-step${generating && genStep >= s.index ? ' is-active' : ''}`}
                >
                  <div className="flow-index">{s.index}</div>
                  <div className="flow-body">
                    <div className="flow-title">{s.title}</div>
                    <div className="flow-desc">{s.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5 大特性 */}
      <div className="section-card features-section">
        <div className="features-grid">
          {features.map((f) => (
            <Tooltip key={f.title} title={f.description} placement="top">
              <div className="feature-item">
                <div
                  className="feature-icon"
                  style={{ background: `${f.iconColor}18`, color: f.iconColor }}
                >
                  {iconMap[f.iconName]}
                </div>
                <div className="feature-text">
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.description}</div>
                </div>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      <Modal
        title="需求分析结果"
        open={analysisOpen}
        onCancel={() => setAnalysisOpen(false)}
        width={760}
        footer={editingResult ? [
          <Button key="cancel" onClick={() => setEditingResult(false)}>取消编辑</Button>,
          <Button key="save" type="primary" onClick={handleSaveEdit}>保存修改</Button>,
        ] : [
          <Button key="edit" onClick={handleEditResult}>编辑分析结果</Button>,
          <Button key="generate" type="primary" loading={generating} onClick={() => void handleGenerateCandidates()}>
            确认并生成 3 个候选方案
          </Button>,
        ]}
      >
        {analysis && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            {(() => {
              const factualFields = ['warehouse_area_m2', 'daily_orders', 'peak_orders_per_hour', 'sku_count', 'tote_agv_count', 'pallet_agv_count', 'robotic_arm_count', 'pick_station_count', 'charger_count'];
              const extracted = factualFields.filter((f) => analysis.profile[f] != null).length;
              return (
                <Alert
                  type="info"
                  showIcon
                  message={analysis.summary || '未识别到结构化信息'}
                  description={<span>已提取 {extracted}/{factualFields.length} 个业务字段 <Tag color={extracted >= 6 ? 'green' : 'orange'}>{extracted >= 6 ? '完整度较高' : '信息较少，建议补充'}</Tag></span>}
                />
              );
            })()}
            <Card size="small" title={editingResult ? '编辑业务画像' : '识别出的业务画像'}>
              {editingResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.keys(analysis.profile).map((key) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 120, flexShrink: 0, fontSize: 13, color: '#374151' }}>{profileLabels[key] ?? key}</span>
                      <Input
                        size="small"
                        value={editFields[key] ?? ''}
                        onChange={(e) => setEditFields((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(analysis.profile).map(([key, value]) => (
                    <Tag key={key} color="blue">{profileLabels[key] ?? key}: {formatProfileValue(value)}</Tag>
                  ))}
                </div>
              )}
            </Card>
            <Card size="small" title={editingResult ? '编辑假设条件' : '确认假设与待确认项（请逐项确认）'}>
              {editingResult ? (() => {
                // 实时计算哪些假设/问题已被当前 editFields 填写解决
                const fieldAQKeywords: Record<string, string[]> = {
                  daily_orders: ['日均订单量', '峰值系数'],
                  peak_orders_per_hour: ['日均订单量', '峰值系数'],
                  flows: ['入库', '拣选', '出库', '作业'],
                  tote_agv_count: ['AGV', '料箱', 'AMR'],
                  pallet_agv_count: ['AGV', '托盘', 'AMR'],
                  agv_count: ['AGV', 'AMR'],
                };
                const nowEditingFilled = Object.entries(editFields)
                  .filter(([_, v]) => v != null && v !== '')
                  .map(([k]) => k);
                const liveKeywords = new Set<string>();
                nowEditingFilled.forEach((f) => (fieldAQKeywords[f] ?? []).forEach((kw) => liveKeywords.add(kw)));
                const keptEditAssumptions = editAssumptions.filter(
                  (a) => ![...liveKeywords].some((kw) => a.includes(kw)),
                );
                const keptEditQuestions = analysis.questions.filter(
                  (q) => ![...liveKeywords].some((kw) => q.includes(kw)),
                );
                const resolvedAssumptionCount = editAssumptions.length - keptEditAssumptions.length;
                const resolvedQuestionCount = analysis.questions.length - keptEditQuestions.length;
                return (
                  <div>
                    {resolvedAssumptionCount > 0 && (
                      <Alert type="success" showIcon style={{ marginBottom: 10, fontSize: 12 }}
                        message={`${resolvedAssumptionCount} 项假设已通过字段填写自动消除`}
                      />
                    )}
                    {keptEditAssumptions.length === 0 && resolvedAssumptionCount === 0 && (
                      <div style={{ color: '#9ca3af', marginBottom: 8, fontSize: 13 }}>无待确认假设</div>
                    )}
                    {keptEditAssumptions.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                        <Input
                          size="small"
                          value={editAssumptions[i] ?? item}
                          onChange={(e) => {
                            const next = [...editAssumptions];
                            next[i] = e.target.value;
                            setEditAssumptions(next);
                          }}
                          style={{ flex: 1 }}
                        />
                        <Button size="small" danger onClick={() => setEditAssumptions((prev) => prev.filter((_, j) => j !== i))}>删除</Button>
                      </div>
                    ))}
                    <Button size="small" type="dashed" onClick={() => setEditAssumptions((prev) => [...prev, ''])} block>
                      + 添加假设
                    </Button>
                    {/* 实时预览待确认项 */}
                    {keptEditQuestions.length > 0 && (
                      <div style={{ marginTop: 14, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8, color: '#374151', fontSize: 13 }}>
                          待确认项（填写字段后将自动消除）
                          {resolvedQuestionCount > 0 && <Tag color="green" style={{ marginLeft: 6 }}>已消除 {resolvedQuestionCount} 项</Tag>}
                        </div>
                        {keptEditQuestions.map((item) => (
                          <div key={item} style={{ marginBottom: 8, opacity: 0.85 }}>
                            <div style={{ marginBottom: 4, color: '#d48806', fontSize: 13 }}>⚠ {item}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>假设条件（勾选表示接受）</div>
                    {analysis.assumptions.length === 0 && <span style={{ color: '#9ca3af' }}>无</span>}
                    {analysis.assumptions.map((item) => (
                      <div key={item} style={{ margin: '4px 0' }}>
                        <Checkbox
                          checked={confirmedAssumptions.includes(item)}
                          onChange={(e) => {
                            setConfirmedAssumptions((prev) =>
                              e.target.checked ? [...prev, item] : prev.filter((a) => a !== item),
                            );
                          }}
                        >
                          {item}
                        </Checkbox>
                      </div>
                    ))}
                  </div>
                  {analysis.questions.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>待确认项（请填写您的实际情况）</div>
                      {analysis.questions.map((item) => (
                        <div key={item} style={{ marginBottom: 8 }}>
                          <div style={{ marginBottom: 4, color: '#d48806' }}>⚠ {item}</div>
                          <Input
                            placeholder="请输入..."
                            value={questionAnswers[item] ?? ''}
                            onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [item]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          </Space>
        )}
      </Modal>

      <Modal
        title="选择要落地的候选方案"
        open={candidateOpen}
        onCancel={() => setCandidateOpen(false)}
        footer={null}
        width={920}
      >
        <Row gutter={[12, 12]}>
          {candidates.length === 0 && (
            <Col span={24}><Empty description="未生成候选方案，请检查需求分析结果后重试" /></Col>
          )}
          {candidates.map((candidate) => (
            <Col xs={24} md={8} key={candidate.id}>
              <Card
                size="small"
                title={candidate.title}
                extra={<Tag color="blue">匹配度 {displayPercent(candidate.suitability ?? 0)}%</Tag>}
                style={{ height: '100%' }}
              >
                <p style={{ minHeight: 44, color: '#64748b' }}>{candidate.description}</p>
                <div style={{ marginBottom: 10 }}>
                  {(() => {
                    const metricLabels: Record<string, string> = {
                      throughput: '吞吐率',
                      wait_seconds: '平均等待(秒)',
                      energy: '能耗系数',
                      completion_rate: '完成率',
                      emptyRate: '空驶率',
                      congestion_count: '拥堵次数',
                    };
                    return Object.entries(candidate.expected_metrics ?? {}).map(([key, value]) => (
                      <Tag key={key}>{metricLabels[key] ?? key}: {typeof value === 'number' ? value.toFixed(1) : value}</Tag>
                    ));
                  })()}
                </div>
                <div style={{ fontSize: 12, color: '#475569', minHeight: 54 }}>
                  {(candidate.reasons ?? []).map((reason) => <div key={reason}>✓ {reason}</div>)}
                  {(candidate.cautions ?? []).map((caution) => <div key={caution}>△ {caution}</div>)}
                </div>
                <Button block type="primary" style={{ marginTop: 12 }} loading={activeOperation === `select-candidate:${candidate.id}`} onClick={() => void handleSelectCandidate(candidate)}>
                  采用此方案并进入编辑器
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      </Modal>

      {/* Industry example selection modal */}
      <Modal
        title="选择行业示例"
        open={showExampleModal}
        onCancel={() => setShowExampleModal(false)}
        footer={null}
        width={720}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '8px 0' }}>
          {INDUSTRY_EXAMPLES.map((example) => (
            <div
              key={example.key}
              onClick={() => handleSelectExample(example)}
              style={{
                padding: 16,
                borderRadius: 10,
                border: '1px solid #eef0f4',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: 'linear-gradient(145deg, #ffffff, #f9fbff)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2b6fff';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(43, 111, 255, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#eef0f4';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background:
                      example.cover === 'ecom' ? '#dbeafe' :
                      example.cover === 'coldchain' ? '#cffafe' :
                      example.cover === '3c' ? '#ede9fe' : '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  {example.cover === 'ecom' ? '\u{1F4E6}' :
                   example.cover === 'coldchain' ? '\u{2744}\u{FE0F}' :
                   example.cover === '3c' ? '\u{1F4F1}' : '\u{1F48A}'}
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1f2937' }}>
                  {example.name}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>
                {example.description}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <Tag color="blue" style={{ fontSize: 11 }}>AGV {example.counts.agvs.tote + example.counts.agvs.pallet}</Tag>
                <Tag color="green" style={{ fontSize: 11 }}>货架 {example.counts.shelves}</Tag>
                <Tag color="orange" style={{ fontSize: 11 }}>工位 {example.counts.stations.pick + example.counts.stations.pack + example.counts.stations.sort}</Tag>
                <Tag color="gold" style={{ fontSize: 11 }}>充电桩 {example.counts.chargers}</Tag>
                {example.counts.arms > 0 && <Tag color="purple" style={{ fontSize: 11 }}>机械臂 {example.counts.arms}</Tag>}
                {example.counts.conveyors > 0 && <Tag color="cyan" style={{ fontSize: 11 }}>传送带 {example.counts.conveyors}</Tag>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: 10, background: '#f0f5ff', borderRadius: 6, fontSize: 12, color: '#2b6fff' }}>
          选择行业示例后，系统会自动填入需求描述（含设备数量），点击「开始生成」即可创建带真实组件的场景。
        </div>
      </Modal>
    </div>
  );
}
