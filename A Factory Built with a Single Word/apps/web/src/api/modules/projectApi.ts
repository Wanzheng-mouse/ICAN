/**
 * 项目 / 模板 API（带 React Hooks 封装）
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import { scenarioTemplates as mockTemplates, templateCards as mockCards, featureItems as mockFeatures, generationSteps as mockSteps, editorSceneComponents as mockComponents, uploadItems as mockUploadItems } from '@ican/mock-data';
import type { FeatureItem, GenerationStep, SceneTemplate, TemplateCard, UploadItem } from '@ican/contracts';
import type { ProjectCreate, ProjectFileRead, ProjectRead, ProjectWorkspaceRead, ScenarioRead, TemplateApplyCreate, TemplateDetailRead } from '@/api/dtos/backend';

export async function getTemplates(category?: string): Promise<SceneTemplate[]> {
  if (USE_MOCK) return mockTemplates;
  const data: SceneTemplate[] = await request({ url: apiUrl('/templates', category ? { category } : {}) });
  return data;
}

export async function getTemplateById(id: string): Promise<TemplateDetailRead | null> {
  if (USE_MOCK) return mockCards.find((t) => t.id === id) ?? null;
  return request({ url: apiUrl(`/templates/${id}`) });
}

export async function applyTemplate(id: string, params: TemplateApplyCreate): Promise<ScenarioRead> {
  if (USE_MOCK) return { id: `scn-${Date.now()}`, project_id: params.project_id, name: params.name, data: { components: [], canvas: { width: 1200, height: 800, scale: 1 }, schema_version: '1.0' }, version: 1, updated_at: new Date().toISOString() };
  return request({ url: apiUrl(`/templates/${id}/apply`), method: 'POST', data: params });
}

export async function createProject(params: ProjectCreate): Promise<ProjectRead> {
  return request({ url: apiUrl('/projects'), method: 'POST', data: params });
}

export function useTemplates(category?: string): UseQueryResult<SceneTemplate[]> {
  return useQuery({ queryKey: ['templates', category], queryFn: () => getTemplates(category) });
}

export async function getProjects(includeArchived = false): Promise<ProjectRead[]> {
  return request({ url: apiUrl('/projects'), params: { include_archived: includeArchived } });
}

export async function getProjectWorkspace(id: string): Promise<ProjectWorkspaceRead> {
  return request({ url: apiUrl(`/projects/${id}/workspace`) });
}

export async function uploadProjectFile(projectId: string, file: File): Promise<ProjectFileRead> {
  const body = await file.arrayBuffer();
  return request({ url: apiUrl(`/projects/${projectId}/files`), method: 'POST', data: body, headers: { 'X-Filename': file.name, 'Content-Type': file.type || 'application/octet-stream' } });
}

export function useProjects(): UseQueryResult<ProjectRead[]> {
  return useQuery({ queryKey: ['projects'], queryFn: () => getProjects() });
}

export function useProjectWorkspace(id: string): UseQueryResult<ProjectWorkspaceRead> {
  return useQuery({ queryKey: ['project-workspace', id], queryFn: () => getProjectWorkspace(id), enabled: Boolean(id) });
}

export async function deleteProjectFile(projectId: string, fileId: string): Promise<void> {
  return request({ url: apiUrl(`/projects/${projectId}/files/${fileId}`), method: 'DELETE' });
}

export async function downloadProjectFile(file: { download_url: string }): Promise<Response> {
  return request({ url: file.download_url, method: 'GET' });
}

export const homeStaticData = {
  features: mockFeatures as FeatureItem[],
  steps: mockSteps as GenerationStep[],
  examples: [] as Array<{ label: string; text: string }>,
};
