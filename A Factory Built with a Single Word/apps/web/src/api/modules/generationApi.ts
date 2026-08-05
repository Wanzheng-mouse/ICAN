import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import { useAppStore } from '@/stores/useAppStore';
import type {
  GenerationCandidatesRead,
  RequirementAnalyzeCreate,
  RequirementAnalysisRead,
  ScenarioRead,
} from '@/api/dtos/backend';

const AGNES_ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;

export function analyzeRequirement(payload: RequirementAnalyzeCreate): Promise<RequirementAnalysisRead> {
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
  return request({ url: apiUrl('/generation/analyze-async'), method: 'POST', data: payload });
}

export function getRequirementAnalysisJob(jobId: string): Promise<RequirementAnalysisRead | GenerationJobStatus> {
  return request({ url: apiUrl(`/generation/${jobId}`), method: 'GET' });
}

export function waitForRequirementAnalysis(
  jobId: string,
  onProgress?: (status: GenerationJobStatus) => void,
): Promise<RequirementAnalysisRead> {
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
    // Exponential backoff: 2s → 3s → 4.5s → 6.75s → 10s (cap), every 5 attempts
    const delay = Math.min(2000 * Math.pow(1.5, Math.floor(attempt / 5)), 10000);
    await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
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
  return request({
    url: apiUrl(`/generation/${isJobId ? payload : (payload as GenerationCandidatesPayload).job_id}/candidates`),
    method: 'POST',
    data: isJobId ? undefined : payload,
  });
}

export function applyGenerationCandidate(jobId: string, candidateId: string, projectId: string, name?: string): Promise<ScenarioRead> {
  return request({
    url: apiUrl(`/generation/${jobId}/candidates/${candidateId}/apply`),
    method: 'POST',
    data: { project_id: projectId, name },
  });
}
