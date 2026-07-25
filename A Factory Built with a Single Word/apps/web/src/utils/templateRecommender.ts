/**
 * 场景模板推荐引擎
 *
 * 根据当前项目/场景特征，对模板库打分并排序，
 * 返回带适配度和推荐理由的结果列表。
 */

import type { SceneTemplate } from '@ican/contracts';

export interface TemplateScore {
  template: SceneTemplate;
  total: number;
  breakdown: {
    industry: number;      // 行业匹配 25%
    scale: number;         // 规模匹配 20%
    device: number;        // 设备兼容 15%
    quality: number;       // 模板质量 15%
    recency: number;       // 时效性 10%
  };
  reasons: string[];
  warnings: string[];
  /** 当前项目已存在的同类设备数量 */
  existingDeviceCount?: number;
}

interface ProjectProfile {
  industry?: string;
  area?: number;
  dailyOrders?: number;
  deviceTypes?: string[];
  agvCount?: number;
  shelfCount?: number;
  armCount?: number;
}

/**
 * 计算模板适配度
 * @param templates 模板列表
 * @param profile 当前项目画像（可选，无则按通用热门排）
 * @param limit 返回条数
 */
export function recommendTemplates(
  templates: SceneTemplate[],
  profile?: ProjectProfile,
  limit = 6,
): TemplateScore[] {
  const scored = templates
    .filter((t) => t.category === 'scene') // 只推荐场景模板
    .map((t) => scoreTemplate(t, profile));

  scored.sort((a, b) => b.total - a.total);
  return scored.slice(0, limit);
}

function scoreTemplate(tpl: SceneTemplate, profile?: ProjectProfile): TemplateScore {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let industryScore = 50;    // 无画像时给中等分
  let scaleScore = 50;
  let deviceScore = 50;
  let qualityScore = 50;
  let recencyScore = 50;

  if (profile) {
    // 行业匹配（25%）
    const industryMap: Record<string, string[]> = {
      '电商': ['电商', '零售', 'ecommerce', 'ecom'],
      '冷链': ['冷链', '冷库', 'coldchain'],
      '医药': ['医药', '制药', 'medical'],
      '3C': ['电子', '数码', '3C'],
      '通用': ['通用', '通用', 'all'],
    };

    const tplIndustry = tpl.industry;
    let industryMatch = false;
    for (const [key, aliases] of Object.entries(industryMap)) {
      if (profile.industry && (aliases.includes(profile.industry) || profile.industry.includes(key))) {
        if (tplIndustry === key || aliases.includes(tplIndustry)) {
          industryMatch = true;
          reasons.push(`与当前项目行业（${profile.industry}）匹配`);
        }
      }
    }
    industryScore = industryMatch ? 100 : (tplIndustry === '通用' ? 60 : 20);

    // 规模匹配（20%）
    const tplDescription = tpl.description.toLowerCase();
    if (profile.dailyOrders && profile.dailyOrders > 10000) {
      if (tplDescription.includes('高峰') || tplDescription.includes('万单')) {
        scaleScore = 100;
        reasons.push('支持高峰订单场景');
      } else {
        scaleScore = 40;
        warnings.push('订单规模可能超出模板推荐范围');
      }
    }

    // 设备兼容（15%）
    const tplScenarioData = (tpl as any).scenarioData;
    if (tplScenarioData?.components) {
      const tplTypes = new Set((tplScenarioData.components as any[]).map((c: any) => c.type));
      const profileTypes = new Set(profile.deviceTypes ?? []);
      let matchCount = 0;
      const totalProfileTypes = profileTypes.size || 1;
      for (const dt of profileTypes) { if (tplTypes.has(dt)) matchCount++; }
      deviceScore = Math.round((matchCount / totalProfileTypes) * 100);
      if (matchCount === totalProfileTypes) reasons.push('设备类型完全兼容');
    }

    // 质量分（15%）- 根据下载和浏览量
    qualityScore = Math.min(100, Math.round(((tpl.downloads ?? 0) / 2000) * 50 + ((tpl.views ?? 0) / 500) * 50));

    // 时效性（10%）
    recencyScore = 50; // 基于 updatedAt
  } else {
    // 无画像：按通用热门
    const dlScore = Math.min(100, Math.round(((tpl.downloads ?? 0) / 100) * 30));
    const vwScore = Math.min(100, Math.round(((tpl.views ?? 0) / 50) * 20));
    qualityScore = Math.max(dlScore, vwScore);
    reasons.push('热门模板');
  }

  const total = Math.round(
    industryScore * 0.25 + scaleScore * 0.20 + deviceScore * 0.15 +
    qualityScore * 0.15 + recencyScore * 0.10,
  );

  return { template: tpl, total, breakdown: { industry: industryScore, scale: scaleScore, device: deviceScore, quality: qualityScore, recency: recencyScore }, reasons, warnings };
}

/**
 * 模板事件追踪（Mock：localStorage）
 */
const EVENTS_KEY = 'ican-template-events';
interface TemplateEvent { templateId: string; type: 'view' | 'apply' | 'download'; timestamp: number; }

export function recordTemplateEvent(templateId: string, type: 'view' | 'apply' | 'download'): void {
  const raw = localStorage.getItem(EVENTS_KEY);
  const events: TemplateEvent[] = raw ? JSON.parse(raw) : [];
  events.push({ templateId, type, timestamp: Date.now() });
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

/** 最近7天应用次数（时间衰减） */
export function getRecentApplyCount(templateId: string): number {
  const raw = localStorage.getItem(EVENTS_KEY);
  if (!raw) return 0;
  const events: TemplateEvent[] = JSON.parse(raw);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  return events.filter((e) => e.templateId === templateId && e.type === 'apply' && e.timestamp > weekAgo).length;
}
