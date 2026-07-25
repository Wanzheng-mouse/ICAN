import { request } from '@/api/client';
import { isMockEnabled } from '@/api/mockConfig';
import { apiUrl } from '@/utils/apiUrl';
import { useAppStore } from '@/stores/useAppStore';
import type {
  GenerationCandidatesRead,
  RequirementAnalyzeCreate,
  RequirementAnalysisRead,
  ScenarioRead,
} from '@/api/dtos/backend';

const USE_MOCK = isMockEnabled('generation');
const AGNES_ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;

// ===== Mock data =====
let mockJobCounter = 0;
const MOCK_ANALYSIS: RequirementAnalysisRead = {
  job_id: 'mock-job-',
  status: 'analyzed',
  summary: '需求分析完成：建议采用多区混合布局，日均处理 15,000 订单，需要 60 台 AGV。',
  analysis_method: 'rule_based',
  profile: {
    industry: '电商',
    warehouse_area_m2: 12000,
    daily_orders: 15000,
    peak_orders_per_hour: 2500,
    sku_count: 8000,
    tote_agv_count: 40,
    pallet_agv_count: 20,
    pick_station_count: 15,
    charger_count: 8,
  },
  assumptions: ['日均订单量按旺季 80% 计算', 'SKU 周转率按 3 天计算', '高峰时段占比 4 小时'],
  questions: ['是否支持跨层拣选？', '是否需要预留冷库区域？', '充电桩是否支持快充？'],
  risks: ['高峰时段通道可能拥堵', '充电桩数量可能不足'],
  confidence: 0.85,
  source_summary: ['已结合行业标准库', '已结合场地约束条件'],
  operational_design: {
    picking_strategy: '批次拣选 + 波次合并',
    replenishment: '定时补货 + 低水位预警',
    charging: '动态调度 + 低电量强制回充',
    layout: '鱼骨式货架 + 环形主通道',
  },
};

const MOCK_CANDIDATES: GenerationCandidatesRead = {
  job_id: 'mock-job-1',
  status: 'generated',
  candidates: [
    {
      id: 'cand-001',
      title: '均衡调度方案',
      strategy: 'balanced',
      description: '兼顾吞吐与能耗，适用于日常运营场景',
      template_id: 'tpl-ecom',
      suitability: 0.92,
      reasons: ['AGV 利用率均衡', '能耗优化 15%', '交付周期稳定'],
      cautions: ['峰值吞吐受限'],
      expected_metrics: { throughput: 1200, energy_saving: 15, completion_rate: 0.95 },
      data: { components: [], canvas: { width: 1400, height: 1000, scale: 1 }, schema_version: '1.0' },
    },
    {
      id: 'cand-002',
      title: '峰值吞吐方案',
      strategy: 'throughput',
      description: '最大化单位时间出库量，适合大促场景',
      template_id: 'tpl-ecom',
      suitability: 0.88,
      reasons: ['吞吐量提升 35%', 'AGV 数量充足', '拣选工位扩容'],
      cautions: ['能耗增加 22%', '设备磨损加快'],
      expected_metrics: { throughput: 1650, energy_saving: -22, completion_rate: 0.98 },
      data: { components: [], canvas: { width: 1400, height: 1000, scale: 1 }, schema_version: '1.0' },
    },
    {
      id: 'cand-003',
      title: '节能优化方案',
      strategy: 'energy_saver',
      description: '降低运营成本，适合非高峰期',
      template_id: 'tpl-ecom',
      suitability: 0.81,
      reasons: ['能耗降低 35%', '设备寿命延长', '充电次数减少'],
      cautions: ['出货效率降低 18%', '高峰时段需切换策略'],
      expected_metrics: { throughput: 980, energy_saving: 35, completion_rate: 0.88 },
      data: { components: [], canvas: { width: 1400, height: 1000, scale: 1 }, schema_version: '1.0' },
    },
  ],
};

function generateMockJobId(): string {
  mockJobCounter += 1;
  return `mock-job-${mockJobCounter}-${Date.now()}`;
}

// ===== Public API =====
export function analyzeRequirement(payload: RequirementAnalyzeCreate): Promise<RequirementAnalysisRead> {
  if (USE_MOCK) {
    return Promise.resolve({ ...MOCK_ANALYSIS, job_id: generateMockJobId(), summary: `已分析：${payload.requirement.slice(0, 50)}` });
  }
  return request({
    url: apiUrl('/generation/analyze'),
    method: 'POST',
    data: payload,
    timeout: AGNES_ANALYSIS_TIMEOUT_MS,
  });
}

export interface GenerationJobStatus {
  job_id: string;
  status: string;
  stage?: string;
  error?: string;
}

export function startRequirementAnalysis(payload: RequirementAnalyzeCreate): Promise<GenerationJobStatus> {
  if (USE_MOCK) {
    return Promise.resolve({ job_id: generateMockJobId(), status: 'queued', stage: 'pending' });
  }
  return request({ url: apiUrl('/generation/analyze-async'), method: 'POST', data: payload });
}

export function getRequirementAnalysisJob(jobId: string): Promise<RequirementAnalysisRead | GenerationJobStatus> {
  if (USE_MOCK) {
    return Promise.resolve({ ...MOCK_ANALYSIS, job_id: jobId, status: 'analyzed' });
  }
  return request({ url: apiUrl(`/generation/${jobId}`), method: 'GET' });
}

export function waitForRequirementAnalysis(
  jobId: string,
  onProgress?: (status: GenerationJobStatus) => void,
): Promise<RequirementAnalysisRead> {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      let step = 0;
      const steps = ['queued', 'analyzing', 'analyzed'];
      const interval = window.setInterval(() => {
        step += 1;
        onProgress?.({ job_id: jobId, status: steps[step - 1], stage: steps[step - 1] });
        if (step >= 3 || steps[step - 1] === 'analyzed') {
          window.clearInterval(interval);
          resolve({ ...MOCK_ANALYSIS, job_id: jobId });
        }
      }, 500);
    });
  }
  const token = useAppStore.getState().token;
  if (!token || typeof EventSource === 'undefined') {
    return pollRequirementAnalysis(jobId, onProgress);
  }
  return new Promise((resolve, reject) => {
    const source = new EventSource(`${apiUrl(`/generation/${jobId}/stream`)}?token=${encodeURIComponent(token)}`);
    const timeout = window.setTimeout(() => {
      source.close();
      reject(new Error('AI 分析超过 5 分钟，请稍后重试'));
    }, AGNES_ANALYSIS_TIMEOUT_MS);
    source.addEventListener('progress', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as RequirementAnalysisRead | GenerationJobStatus;
      onProgress?.(payload);
      if (payload.status === 'analyzed' && 'profile' in payload) {
        window.clearTimeout(timeout); source.close(); resolve(payload);
      } else if (payload.status === 'failed') {
        window.clearTimeout(timeout); source.close(); reject(new Error(('error' in payload && payload.error) || 'AI 分析失败'));
      }
    });
    source.onerror = () => {
      window.clearTimeout(timeout);
      source.close();
      void pollRequirementAnalysis(jobId, onProgress).then(resolve, reject);
    };
  });
}

async function pollRequirementAnalysis(jobId: string, onProgress?: (status: GenerationJobStatus) => void): Promise<RequirementAnalysisRead> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 2000));
    const current = await getRequirementAnalysisJob(jobId);
    onProgress?.(current as GenerationJobStatus);
    if (current.status === 'failed') throw new Error(('error' in current && current.error) || 'AI 分析失败');
    if (current.status === 'analyzed' && 'profile' in current) return current as RequirementAnalysisRead;
  }
  throw new Error('AI 分析超过 5 分钟，请稍后重试');
}

export interface GenerationCandidatesPayload {
  job_id: string;
  profile?: Record<string, unknown>;
  assumptions?: string[];
  questions?: Record<string, string>;
}

export function generatePlanCandidates(payload: string | GenerationCandidatesPayload): Promise<GenerationCandidatesRead> {
  const isJobId = typeof payload === 'string';
  if (USE_MOCK) {
    return Promise.resolve({ ...MOCK_CANDIDATES, job_id: isJobId ? payload : (payload as GenerationCandidatesPayload).job_id });
  }
  return request({
    url: apiUrl(`/generation/${isJobId ? payload : (payload as GenerationCandidatesPayload).job_id}/candidates`),
    method: 'POST',
    data: isJobId ? undefined : payload,
  });
}

export function applyGenerationCandidate(jobId: string, candidateId: string, projectId: string, name?: string): Promise<ScenarioRead> {
  if (USE_MOCK) {
    const candidate = MOCK_CANDIDATES.candidates.find((c) => c.id === candidateId);
    return Promise.resolve({
      id: `scn-mock-${Date.now()}`,
      project_id: projectId,
      name: name ?? '智能生成场景',
      data: candidate?.data ?? { components: [], canvas: { width: 1400, height: 1000, scale: 1 }, schema_version: '1.0' },
      version: 1,
      updated_at: new Date().toISOString(),
    });
  }
  return request({
    url: apiUrl(`/generation/${jobId}/candidates/${candidateId}/apply`),
    method: 'POST',
    data: { project_id: projectId, name },
  });
}
