/**
 * 项目 / 模板 API（带 React Hooks 封装）
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import type { FeatureItem, GenerationStep, SceneTemplate } from '@ican/contracts';
import type { ProjectCreate, ProjectFileRead, ProjectMemberRead, ProjectMemberUpsert, ProjectRead, ProjectUpdate, ProjectWorkspaceRead, ScenarioRead, TemplateApplyCreate, TemplateDetailRead } from '@/api/dtos/backend';

export async function getTemplates(category?: string): Promise<SceneTemplate[]> {
  const data: SceneTemplate[] = await request({ url: apiUrl('/templates', category ? { category } : {}) });
  return data;
}

export async function getTemplateById(id: string): Promise<TemplateDetailRead | null> {
  return request({ url: apiUrl(`/templates/${id}`) });
}

export async function applyTemplate(id: string, params: TemplateApplyCreate): Promise<ScenarioRead> {
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

export async function uploadProjectFile(projectId: string, file: File, kind = 'attachment'): Promise<ProjectFileRead> {
  const body = await file.arrayBuffer();
  return request({ url: apiUrl(`/projects/${projectId}/files`), method: 'POST', params: { kind }, data: body, headers: { 'X-Filename': file.name, 'Content-Type': file.type || 'application/octet-stream' } });
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

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  return request({ url: apiUrl(`/projects/${projectId}/members/${userId}`), method: 'DELETE' });
}

export async function upsertProjectMember(projectId: string, payload: ProjectMemberUpsert): Promise<ProjectMemberRead> {
  return request({ url: apiUrl(`/projects/${projectId}/members`), method: 'POST', data: payload });
}

export function useProjectMembers(projectId: string): UseQueryResult<ProjectMemberRead[]> {
  return useQuery({ queryKey: ['project-members', projectId], queryFn: () => request<ProjectMemberRead[]>({ url: apiUrl(`/projects/${projectId}/members`) }), enabled: Boolean(projectId) });
}

export function useUpdateProject(): UseMutationResult<ProjectRead, Error, { id: string; changes: ProjectUpdate }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }) => request({ url: apiUrl(`/projects/${id}`), method: 'PATCH', data: changes }),
    onSuccess: (_project, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['project-workspace', variables.id] });
    },
  });
}

export const homeStaticData: {
  features: FeatureItem[];
  steps: GenerationStep[];
  examples: Array<{ label: string; text: string }>;
} = {
  features: [],
  steps: [],
  examples: [],
};
