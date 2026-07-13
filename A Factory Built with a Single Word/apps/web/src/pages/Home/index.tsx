import { useMemo, useState } from 'react';
import {
  CheckCircleFilled,
  CloudUploadOutlined,
  CodeOutlined,
  CommentOutlined,
  DatabaseOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  LinkOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  RiseOutlined,
  RocketOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { App, Button, Input, Progress, Skeleton, Space, Steps, Tag, Tooltip, Upload, type UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { homeStaticData, useTemplates } from '@/api/modules';
import { HeroIllustration } from '@/components';
import { heroBanner, requirementPlaceholder } from '@ican/mock-data';
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

const templateRouteMap: Record<string, string> = {
  '电商中型仓': '/editor',
  '冷链多温区': '/editor',
  '3C 高峰订单': '/editor',
  '医药合规仓': '/editor',
};

const sampleRequirements = [
  '根据仓库平面图和今日订单，自动创建无人仓仿真方案，并优化拥堵、充电策略和任务分配效率。',
  '冷链多温区场景：双温区分离，AGV 优先处理高优先级订单，确保电池电量不低于 20%。',
  '3C 高峰订单场景：模拟日均 8000 单的拣选与发货，重点关注高密度货架的并发调度。',
];

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
  const [requirement, setRequirement] = useState('');
  const [uploadedSlots, setUploadedSlots] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);

  // 阶段 1：直接通过 homeStaticData 获取；阶段 2：可改为 useTemplates 等异步 hook
  const cards = useMemo(() => homeStaticData.cards(), []);
  const features = useMemo(() => homeStaticData.features(), []);
  const steps = useMemo(() => homeStaticData.steps(), []);
  const uploads = useMemo(() => homeStaticData.uploadItems(), []);
  // 演示异步查询（始终返回 mock），用于将来切真实后端时验证 QueryClient 流程
  const { isLoading: templatesLoading } = useTemplates('scene');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  const handleUpload: UploadProps['customRequest'] = (options) => {
    setTimeout(() => {
      options.onSuccess?.({});
      if (options.file) {
        setUploadedSlots((s) => ({ ...s, [options.filename as string]: true }));
        message.success(`已上传 ${options.filename}`);
      }
    }, 400);
  };

  const handleGenerate = () => {
    if (!requirement.trim()) {
      message.warning('请先输入需求');
      return;
    }
    setGenerating(true);
    setGenStep(0);
    const interval = setInterval(() => {
      setGenStep((prev) => {
        if (prev >= 6) {
          clearInterval(interval);
          setGenerating(false);
          message.success('方案生成完成！即将跳转到场景编辑器');
          setTimeout(() => navigate('/editor'), 1200);
          return 6;
        }
        return prev + 1;
      });
    }, 700);
  };

  const handleUseExample = () => {
    const sample = sampleRequirements[Math.floor(Math.random() * sampleRequirements.length)];
    setRequirement(sample);
    message.info('已填入示例需求');
  };

  const handleTemplateAction = (tplTitle: string, action: 'preview' | 'use' | 'quick') => {
    if (action === 'preview') {
      message.info(`正在预览「${tplTitle}」场景模板`);
    } else if (action === 'use') {
      message.success(`已应用「${tplTitle}」模板，正在跳转到场景编辑器`);
      setTimeout(() => navigate(templateRouteMap[tplTitle] ?? '/editor'), 800);
    } else if (action === 'quick') {
      message.loading('快速体验模式：已启动「' + tplTitle + '」仿真', 1.2);
      setTimeout(() => navigate('/simulation'), 1300);
    }
  };

  return (
    <div className="page-container home-page">
      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="hero-text">
          <h1 className="hero-title">{heroBanner.title}</h1>
          <p className="hero-subtitle">{heroBanner.subtitle}</p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Tag color="blue" style={{ padding: '4px 12px', fontSize: 12 }}>
              <RocketOutlined /> 已支持 7 步智能闭环
            </Tag>
            <Tag color="green" style={{ padding: '4px 12px', fontSize: 12 }}>
              <PlayCircleOutlined /> 10+ 场景模板即选即用
            </Tag>
          </div>
        </div>
        <div className="hero-image">
          <HeroIllustration variant="warehouse" height={240} />
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="home-grid">
        <div className="home-main">
          {/* 需求输入 */}
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
                showCount
                autoSize={{ minRows: 4, maxRows: 8 }}
                className="requirement-input"
                disabled={generating}
              />
              <div className="requirement-actions">
                <Button
                  type="primary"
                  size="large"
                  icon={<RocketOutlined />}
                  onClick={handleGenerate}
                  loading={generating}
                >
                  {generating ? '生成中...' : '开始生成'}
                </Button>
                <Button size="large" icon={<FileTextOutlined />} onClick={handleUseExample}>
                  查看示例
                </Button>
              </div>
              {generating && (
                <div style={{ marginTop: 12, padding: 12, background: '#f0f5ff', borderRadius: 6 }}>
                  <div style={{ marginBottom: 6, fontSize: 12, color: '#2b6fff' }}>
                    正在执行：{steps[genStep]?.title} ({genStep + 1}/7)
                  </div>
                  <Progress percent={Math.round(((genStep + 1) / 7) * 100)} showInfo={false} strokeColor="#2b6fff" />
                </div>
              )}
            </div>
          </div>

          {/* 4 个文件上传 */}
          <div className="section-card">
            <div className="section-title flex-between" style={{ marginBottom: 16 }}>
              <span>
                <span className="icon">📎</span>
                补充资料
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                已上传 {Object.keys(uploadedSlots).length} / {uploads.length}
              </span>
            </div>
            <div className="upload-grid">
              {uploads.map((item) => (
                <div key={item.slot} className={`upload-card ${uploadedSlots[item.slot] ? 'uploaded' : ''}`}>
                  <div className="upload-card-icon" style={{ background: `${item.iconColor}18`, color: item.iconColor }}>
                    {iconMap[item.iconName]}
                  </div>
                  <div className="upload-card-body">
                    <div className="upload-card-title">{item.title}</div>
                    <div className="upload-card-desc">{item.description}</div>
                    <Upload
                      accept={item.accept}
                      customRequest={handleUpload}
                      showUploadList={false}
                      maxCount={1}
                    >
                      <Button type="default" icon={<CloudUploadOutlined />} className="upload-btn">
                        {uploadedSlots[item.slot] ? '已上传 · 重新上传' : '上传文件'}
                      </Button>
                    </Upload>
                  </div>
                  {uploadedSlots[item.slot] && (
                    <CheckCircleFilled style={{ position: 'absolute', top: 12, right: 12, color: '#22c55e', fontSize: 18 }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 热门场景模板 */}
          <div className="section-card">
            <div className="section-title flex-between" style={{ marginBottom: 16 }}>
              <span>
                <span className="icon">🔥</span>
                热门场景模板
              </span>
              <a className="more-link" onClick={() => navigate('/resource')}>查看更多模板 →</a>
            </div>
            <div className="template-grid">
              {templatesLoading ? <Skeleton active style={{ gridColumn: '1 / -1' }} /> : cards.map((tpl) => (
                <div key={tpl.title} className="template-card-item">
                  <HeroIllustration variant={tpl.cover as 'ecom' | 'coldchain' | '3c' | 'medical'} height={110} />
                  <div className="template-card-body">
                    <div className="template-card-title">{tpl.title}</div>
                    <div className="template-card-desc">{tpl.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <Tag color="blue" className="template-tag">{tpl.tag}</Tag>
                      <Space size={4}>
                        <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => handleTemplateAction(tpl.title, 'preview')} />
                        <Button size="small" type="primary" onClick={() => handleTemplateAction(tpl.title, 'use')}>
                          使用模板
                        </Button>
                      </Space>
                    </div>
                    <Button block size="small" type="dashed" icon={<PlayCircleOutlined />} style={{ marginTop: 6 }} onClick={() => handleTemplateAction(tpl.title, 'quick')}>
                      快速体验
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧 7 步流程 */}
        <div className="home-aside">
          <div className="section-card flow-card">
            <div className="section-title">生成流程预览</div>
            <Steps
              direction="vertical"
              size="small"
              current={generating ? genStep : -1}
              items={steps.map((s) => ({
                title: s.title,
                description: s.description,
              }))}
            />
          </div>
        </div>
      </div>

      {/* 5 大特性 */}
      <div className="section-card features-section">
        <div className="features-grid">
          {features.map((f) => (
            <Tooltip key={f.title} title={f.description} placement="top">
              <div className="feature-item">
                <div className="feature-icon" style={{ background: `${f.iconColor}18`, color: f.iconColor }}>
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
    </div>
  );
}
