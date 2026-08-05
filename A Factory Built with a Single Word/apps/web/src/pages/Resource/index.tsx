import { useState } from 'react';
import { App, Avatar, Button, Input, List, Modal, Select, Skeleton, Tabs, Tag } from 'antd';
import { CloudUploadOutlined, DownloadOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { SceneTemplate } from '@ican/contracts';
import {
  useFeaturedCases,
  useHotResources,
  useLearningPath,
  useResourceCategories,
  useResourceTemplates,
} from '@/api/modules';
import { SectionCard, HeroIllustration } from '@/components';
import './index.css';

const categoryColors: Record<string, [string, string]> = {
  scene: ['#dbeafe', '#bfdbfe'],
  strategy: ['#fef3c7', '#fde68a'],
  report: ['#fce7f3', '#fbcfe8'],
  device: ['#d1fae5', '#a7f3d0'],
  case: ['#ede9fe', '#ddd6fe'],
  doc: ['#cffafe', '#a5f3fc'],
};
function _TemplateThumb({ category, title }: { category: string; title: string }) {
  const [c1, c2] = categoryColors[category] ?? ['#e2e8f0', '#cbd5e1'];
  return (
    <div
      className="tpl-thumb"
      style={{
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
      }}
    >
      <div className="tpl-thumb-shelves" />
      <div className="tpl-thumb-agv" style={{ left: '15%' }} />
      <div className="tpl-thumb-agv" style={{ left: '55%' }} />
      <div className="tpl-thumb-label">{title}</div>
    </div>
  );
}

function CaseCover({ type }: { type: string; label?: string }) {
  const palettes: Record<string, [string, string, string]> = {
    ecom: ['#1e293b', '#374151', '#22c55e'],
    coldchain: ['#0c4a6e', '#0369a1', '#06b6d4'],
    medical: ['#581c87', '#7e22ce', '#a855f7'],
  };
  const [before, after, accent] = palettes[type] ?? palettes.ecom;
  return (
    <div className="case-cover">
      <div className="case-cover-before" style={{ background: `linear-gradient(135deg, ${before} 0%, ${after} 100%)` }}>
        <span className="cover-label">Before</span>
        <div className="cover-mini-grid">
          <div /><div /><div /><div /><div /><div />
        </div>
        <div className="cover-low-rate">效率 65%</div>
      </div>
      <div className="case-cover-after" style={{ background: `linear-gradient(135deg, ${after} 0%, ${accent} 100%)` }}>
        <span className="cover-label">After</span>
        <div className="cover-mini-paths">
          <div className="cover-path" />
          <div className="cover-path" />
          <div className="cover-path" />
        </div>
        <div className="cover-high-rate">效率 92%</div>
      </div>
    </div>
  );
}

export default function Resource() {
  const { message } = App.useApp();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [previewTpl, setPreviewTpl] = useState<SceneTemplate | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // ===== 领域 API 接入 =====
  const { data: categoriesData } = useResourceCategories();
  const { data: templatesData, isLoading: _templatesLoading } = useResourceTemplates();
  const { data: casesData, isLoading: casesLoading } = useFeaturedCases();
  const { data: hotData } = useHotResources();
  const { data: pathData } = useLearningPath();

  const categories = categoriesData ?? [];
  const templates = templatesData ?? [];
  const cases = casesData ?? [];
  const hot = hotData ?? [];
  const learning = pathData ?? [];

  const filteredTemplates = templates.filter((t) => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (searchValue && !t.title.includes(searchValue) && !t.description.includes(searchValue)) return false;
    return true;
  });

  const handlePreview = (tpl: SceneTemplate) => {
    setPreviewTpl(tpl);
    message.info(`预览「${tpl.title}」`);
  };

  const handleUse = (tpl: SceneTemplate) => {
    message.success(`已应用「${tpl.title}」模板，即将跳转到场景编辑器`);
  };

  const handleDownload = (tpl: SceneTemplate) => {
    message.success(`「${tpl.title}」已加入下载队列`);
  };

  return (
    <div className="resource-page">
      <div className="resource-header">
        <div className="resource-header-text">
          <h1 className="resource-title">资源中心</h1>
          <p className="resource-subtitle">模板、案例、配置文件与学习资料，一站获取</p>
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <Tag color="blue">{templates.length} 个模板</Tag>
            <Tag color="green">{cases.length} 个精选案例</Tag>
            <Tag color="orange">{learning.length} 个学习路径</Tag>
          </div>
        </div>
        <div className="resource-header-illustration">
          <div className="res-illu-icon" style={{ left: 30, top: 10 }}>📋</div>
          <div className="res-illu-icon" style={{ left: 80, top: 30 }}>📦</div>
          <div className="res-illu-icon" style={{ left: 50, top: 60 }}>📑</div>
          <div className="res-illu-icon" style={{ left: 110, top: 70 }}>⚙️</div>
          <div className="res-illu-icon" style={{ left: 140, top: 40 }}>🏭</div>
        </div>
        <div className="resource-header-actions">
          <Input
            placeholder="搜索模板、案例、文档或配置..."
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            allowClear
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <Button icon={<CloudUploadOutlined />} onClick={() => message.info('上传资源（演示）')}>上传资源</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>创建模板</Button>
        </div>
      </div>

      <div className="resource-grid">
        <div className="resource-main">
          <SectionCard className="resource-tabs-card">
            <Tabs
              activeKey={activeCategory}
              onChange={setActiveCategory}
              items={categories.map((c) => ({ key: c.key, label: `${c.label} (${c.key === 'all' ? templates.length : templates.filter((t) => t.category === c.key).length})` }))}
            />
            <div className="resource-filters">
              <div className="filter-item">
                <span className="filter-label">行业</span>
                <Select defaultValue="all" style={{ width: 140 }} options={[{ value: 'all', label: '全部行业' }]} />
              </div>
              <div className="filter-item">
                <span className="filter-label">难度</span>
                <Select defaultValue="all" style={{ width: 140 }} options={[{ value: 'all', label: '全部难度' }]} />
              </div>
              <div className="filter-item">
                <span className="filter-label">最近更新</span>
                <Select defaultValue="all" style={{ width: 140 }} options={[{ value: 'all', label: '全部时间' }]} />
              </div>
              <div style={{ flex: 1 }} />
              <div className="filter-item">
                <Select defaultValue="default" style={{ width: 140 }} options={[{ value: 'default', label: '默认排序' }]} />
              </div>
            </div>
            {filteredTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                未找到匹配的资源，换个关键词试试？
              </div>
            ) : (
              <div className="tpl-grid">
                {filteredTemplates.map((tpl) => (
                  <div key={tpl.id} className="tpl-card">
                    <HeroIllustration
                      variant={tpl.category === 'device' ? 'agv' : tpl.category === 'strategy' ? 'arm' : (tpl.title.includes('电商') ? 'ecom' : tpl.title.includes('冷链') ? 'coldchain' : tpl.title.includes('3C') ? '3c' : tpl.title.includes('医药') ? 'medical' : 'warehouse')}
                      height={100}
                    />
                    <div className="tpl-card-body">
                      <Tag color={tpl.category === 'scene' ? 'blue' : tpl.category === 'strategy' ? 'gold' : tpl.category === 'report' ? 'magenta' : tpl.category === 'device' ? 'green' : 'purple'} className="tpl-cat-tag">
                        {tpl.category === 'scene' ? '场景模板' : tpl.category === 'strategy' ? '策略模板' : tpl.category === 'report' ? '报告模板' : tpl.category === 'device' ? '设备配置' : '案例'}
                      </Tag>
                      <div className="tpl-card-title">{tpl.title}</div>
                      <div className="tpl-card-desc">{tpl.description}</div>
                      <div className="tpl-card-meta">
                        <span>📅 {tpl.updatedAt}</span>
                        <span>⬇ {tpl.downloadsLabel}</span>
                        <span>👁 {tpl.viewsLabel}</span>
                      </div>
                      <div className="tpl-card-actions">
                        <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(tpl)}>预览</Button>
                        <Button size="small" type="primary" onClick={() => handleUse(tpl)}>使用模板</Button>
                        <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => handleDownload(tpl)}>下载</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="精选案例" extra={<a>查看全部案例</a>}>
            <div className="case-grid">
              {casesLoading ? <Skeleton active style={{ width: '100%' }} /> : cases.map((c) => (
                <div key={c.title} className="case-card">
                  <CaseCover type={c.cover.split('-')[0]} label={c.title} />
                  <div className="case-body">
                    <div className="case-title">{c.title}</div>
                    <div className="case-desc">{c.description}</div>
                    <div className="case-stats">
                      {c.efficiency && <div className="case-stat"><div className="stat-label">效率提升</div><div className="stat-val num-font">{c.efficiency}</div></div>}
                      {c.manpower && <div className="case-stat"><div className="stat-label">人力减少</div><div className="stat-val num-font">{c.manpower}</div></div>}
                      {c.roi && <div className="case-stat"><div className="stat-label">ROI 周期</div><div className="stat-val num-font">{c.roi}</div></div>}
                      {c.energy && <div className="case-stat"><div className="stat-label">能耗</div><div className="stat-val num-font">{c.energy}</div></div>}
                      {c.complaint && <div className="case-stat"><div className="stat-label">投诉下降</div><div className="stat-val num-font">{c.complaint}</div></div>}
                      {c.audit && <div className="case-stat"><div className="stat-label">审计效率</div><div className="stat-val num-font">{c.audit}</div></div>}
                    </div>
                    <a className="case-link" onClick={() => message.info(`查看「${c.title}」案例详情`)}>查看案例详情 →</a>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="resource-aside">
            <SectionCard title="推荐学习路径">
              <div className="learning-list">
                {learning.length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>暂无学习路径</div> : learning.map((p, i) => (
                  <List.Item key={`${p.index}-${p.title}-${i}`}>
                    <List.Item.Meta
                      avatar={<Avatar size="small" style={{ backgroundColor: '#2563eb' }}>{i + 1}</Avatar>}
                      title={<span style={{ fontSize: 14 }}>{p.title}</span>}
                      description={<span style={{ fontSize: 12 }}>{p.description}</span>}
                    />
                  </List.Item>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="热门资源">
              {hot.length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>暂无热门资源</div> : <List
                dataSource={hot}
                renderItem={(r, i) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag color={i < 3 ? 'gold' : 'default'}>{r.rank || i + 1}</Tag>}
                      title={<span style={{ fontSize: 13 }}>{r.name}</span>}
                      description={<span style={{ fontSize: 12, color: '#94a3b8' }}>⬇ {r.downloads}  👁 {r.views}</span>}
                    />
                  </List.Item>
                )}
              />}
            </SectionCard>
        </div>
      </div>

      <Modal
        title="预览模板"
        open={previewTpl !== null}
        onCancel={() => setPreviewTpl(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewTpl(null)}>关闭</Button>,
          <Button key="use" type="primary" onClick={() => { handleUse(previewTpl!); setPreviewTpl(null); }}>使用此模板</Button>,
        ]}
      >
        {previewTpl && (
          <div>
            <HeroIllustration
              variant={previewTpl.category === 'device' ? 'agv' : previewTpl.category === 'strategy' ? 'arm' : (previewTpl.title.includes('电商') ? 'ecom' : previewTpl.title.includes('冷链') ? 'coldchain' : previewTpl.title.includes('3C') ? '3c' : previewTpl.title.includes('医药') ? 'medical' : 'warehouse')}
              height={180}
            />
            <div style={{ marginTop: 12 }}>
              <Tag color="blue">{previewTpl.category === 'scene' ? '场景模板' : previewTpl.category}</Tag>
              <h3 style={{ margin: '8px 0' }}>{previewTpl.title}</h3>
              <p style={{ color: '#6b7280' }}>{previewTpl.description}</p>
              <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
                📅 {previewTpl.updatedAt} · ⬇ {previewTpl.downloadsLabel} · 👁 {previewTpl.viewsLabel}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="创建模板"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => { setCreateModalOpen(false); message.success('模板已创建（演示）'); }}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ padding: '12px 0' }}>
          <div style={{ marginBottom: 8, color: '#6b7280', fontSize: 13 }}>模板名称</div>
          <Input placeholder="请输入模板名称" />
          <div style={{ marginTop: 12, marginBottom: 8, color: '#6b7280', fontSize: 13 }}>模板类型</div>
          <Select defaultValue="scene" style={{ width: '100%' }} options={[
            { value: 'scene', label: '场景模板' },
            { value: 'strategy', label: '策略模板' },
            { value: 'report', label: '报告模板' },
            { value: 'device', label: '设备配置' },
          ]} />
          <div style={{ marginTop: 12, marginBottom: 8, color: '#6b7280', fontSize: 13 }}>描述</div>
          <Input.TextArea placeholder="请输入模板描述" rows={3} />
        </div>
      </Modal>
    </div>
  );
}
