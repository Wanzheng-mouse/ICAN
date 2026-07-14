/**
 * 项目 / 模板 API（带 React Hooks 封装）
 *
 * 路径统一通过 apiUrl() 生成：
 * - 模板静态数据走 /api/templates
 * - 项目创建走 /api/v1/projects
 * - 文件上传走 /api/v1/projects/{id}/files
 *
 * Mock 模式：直接返回本地 mock 数据
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { USE_MOCK } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import {
  scenarioTemplates as mockTemplates,
  templateCards as mockCards,
  featureItems as mockFeatures,
  generationSteps as mockSteps,
  editorSceneComponents as mockComponents,
  uploadItems as mockUploadItems,
} from '@ican/mock-data';

import type { FeatureItem, GenerationStep, SceneTemplate, TemplateCard, UploadItem } from '@ican/contracts';
import type { ProjectCreate, ProjectRead, ScenarioRead, TemplateApplyCreate, TemplateDetailRead } from '@/api/dtos/backend';

// ===== 纯数据函数 =====

export async function getTemplates(category?: string): Promise<SceneTemplate[]> {
  if (USE_MOCK) return category ? mockTemplates.filter((t) => t.category === category) : mockTemplates;
  return request({ url: apiUrl('/templates'), params: category ? { category } : {} });
}

export async function getTemplateById(id: string): Promise<TemplateDetailRead | null> {
  if (USE_MOCK) {
    const template = mockTemplates.find((t) => t.id === id);
    if (!template) return null;
    return {
      ...template,
      data: { components: mockComponents, canvas: { width: 1200, height: 800, scale: 1 }, schema_version: '1.0' },
    };
  }
  return request({ url: apiUrl(`/templates/${id}`) });
}

export async function applyTemplate(id: string, params: TemplateApplyCreate): Promise<ScenarioRead> {
  if (USE_MOCK) {
    const template = await getTemplateById(id);
    if (!template || template.category !== 'scene') throw new Error('该模板不能应用为场景');
    return { id: `scn-${Date.now()}`, project_id: params.project_id, name: params.name ?? template.title, data: template.data, updated_at: new Date().toISOString() };
  }
  return request({ url: apiUrl(`/templates/${id}/apply`), method: 'POST', data: params });
}

export async function createProject(params: ProjectCreate): Promise<ProjectRead> {
  if (USE_MOCK) return { id: `proj-${Date.now()}`, name: params.name, requirement: params.requirement ?? '', status: 'draft', created_at: new Date().toISOString() };
  return request({ url: apiUrl('/projects'), method: 'POST', data: params });
}

// ===== React Hooks =====

export function useTemplates(category?: string): UseQueryResult<SceneTemplate[]> {
  return useQuery({
    queryKey: ['templates', category ?? 'all'],
    queryFn: () => getTemplates(category),
    staleTime: 5 * 60 * 1000,
  });
}

/** 首页静态数据 —— 仍为同步常量 */
export const homeStaticData = {
  cards: (): TemplateCard[] => mockCards,
  features: (): FeatureItem[] => mockFeatures,
  steps: (): GenerationStep[] => mockSteps,
  uploadItems: (): UploadItem[] => mockUploadItems,
};
