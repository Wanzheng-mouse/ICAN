import { Card, Input, Tag } from 'antd';
import {
  BookOutlined,
  BulbOutlined,
  CommentOutlined,
  CustomerServiceOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { SectionCard } from '@/components';
import { learningPath } from '@ican/mock-data';
import './index.css';

const helpCategories = [
  { icon: <PlayCircleOutlined />, title: '快速开始', description: '5 分钟创建你的第一个无人仓方案', count: 8 },
  { icon: <BookOutlined />, title: '使用手册', description: '系统功能详解与最佳实践', count: 32 },
  { icon: <ThunderboltOutlined />, title: '场景模板', description: '电商/冷链/3C/医药场景参考', count: 16 },
  { icon: <BulbOutlined />, title: '优化策略', description: '拥堵、能耗、调度优化技巧', count: 12 },
  { icon: <FileTextOutlined />, title: 'API 文档', description: 'REST 与 WebSocket 接口说明', count: 48 },
  { icon: <CommentOutlined />, title: '常见问题', description: 'FAQ 与故障排查', count: 24 },
];

const faqs = [
  { q: '如何快速创建一个无人仓仿真方案？', a: '在首页选择合适的场景模板，填写需求描述，上传相关文件后点击"开始生成"即可。系统会自动完成需求理解、场景生成、任务编排和仿真运行。' },
  { q: '方案进化报告如何生成？', a: '完成至少一轮仿真后，点击控制条的"运行进化"按钮，系统会基于当前指标进行规则调参和方案优化，生成 v1.0 → v2.0 的对比报告。' },
  { q: '支持哪些类型的异常注入？', a: '目前支持道路封闭、低电量、订单激增和站点故障四类异常，可在仿真控制台通过"注入异常"按钮添加。' },
  { q: '如何导出仿真报告？', a: '在方案进化报告页点击"导出报告"按钮，可选择 PDF/PPT/MP4/ZIP/JSON 五种格式。' },
  { q: 'AGV 数量和配置如何调整？', a: '在场景编辑器中调整资源库的 AGV 数量，或在任务编排页修改"任务分配策略"参数。' },
];

export default function Help() {
  return (
    <div className="help-page">
      {/* Hero */}
      <div className="help-hero">
        <div className="help-hero-text">
          <h1 className="help-title">帮助中心</h1>
          <p className="help-subtitle">查找文档、教程、API 参考和常见问题</p>
          <Input.Search
            placeholder="搜索问题、文档或功能..."
            size="large"
            style={{ maxWidth: 480, marginTop: 16 }}
            enterButton
          />
        </div>
      </div>

      {/* 分类卡片 */}
      <SectionCard title="📚 文档分类">
        <div className="help-grid">
          {helpCategories.map((c) => (
            <Card key={c.title} className="help-cat-card" hoverable>
              <div className="help-cat-icon">{c.icon}</div>
            <div className="help-cat-title">{c.title}</div>
            <div className="help-cat-desc">{c.description}</div>
              <Tag color="blue">{c.count} 篇</Tag>
            </Card>
          ))}
        </div>
      </SectionCard>

      {/* 学习路径 */}
      <SectionCard title="🎓 推荐学习路径">
        <div className="help-learning">
          {learningPath.map((p) => (
            <div key={p.index} className="help-learning-step">
              <div className="help-learning-index">{p.index}</div>
              <div className="help-learning-body">
                <div className="help-learning-title">{p.title}</div>
                <div className="help-learning-desc">{p.description}</div>
                <div className="help-learning-meta">
                  <Tag color="blue">{p.duration}</Tag>
                  <Tag>{p.resourceCount} 个资源</Tag>
                </div>
              </div>
              <a className="help-learning-action">开始学习 →</a>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* FAQ */}
      <SectionCard title="❓ 常见问题">
        <div className="faq-list">
          {faqs.map((f, i) => (
            <div key={i} className="faq-item">
              <div className="faq-q">
                <QuestionCircleOutlined style={{ color: '#2b6fff', marginRight: 8 }} />
                {f.q}
              </div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 联系 */}
      <div className="help-contact">
        <div className="help-contact-item">
          <CustomerServiceOutlined style={{ fontSize: 24, color: '#2b6fff' }} />
          <div>
            <div className="help-contact-title">技术支持</div>
            <div className="help-contact-desc">support@ican-platform.com</div>
          </div>
        </div>
        <div className="help-contact-item">
          <CommentOutlined style={{ fontSize: 24, color: '#22c55e' }} />
          <div>
            <div className="help-contact-title">加入社区</div>
            <div className="help-contact-desc">GitHub Issues · 微信群</div>
          </div>
        </div>
      </div>
    </div>
  );
}
