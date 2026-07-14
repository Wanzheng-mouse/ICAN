import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Input, List, Skeleton, Tag, Button, Segmented } from 'antd';
import { FolderOutlined, ExperimentOutlined, FundOutlined, AppstoreOutlined, HomeOutlined } from '@ant-design/icons';
import { SectionCard } from '@/components';
import { searchIndex, type SearchResult } from '@/stores/searchIndex';
import './Search.css';

const typeIcon: Record<string, React.ReactNode> = {
  project: <FolderOutlined />, scene: <AppstoreOutlined />,
  report: <FundOutlined />, template: <ExperimentOutlined />,
};

const typeColor: Record<string, string> = { project: 'blue', scene: 'green', report: 'purple', template: 'gold' };
const typeLabel: Record<string, string> = { project: '项目', scene: '场景', report: '报告', template: '模板' };

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((p, i) => p.toLowerCase() === query.toLowerCase() ? <mark key={i} className="search-highlight">{p}</mark> : p);
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') ?? '';
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (!q.trim()) { setLoading(false); setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      setResults(searchIndex(q));
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return results;
    return results.filter((r) => r.type === typeFilter);
  }, [results, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: results.length };
    results.forEach((r) => { counts[r.type] = (counts[r.type] ?? 0) + 1; });
    return counts;
  }, [results]);

  return (
    <div className="search-page">
      <div className="search-header">
        <h1 className="search-title">搜索结果</h1>
        <Input.Search
          defaultValue={q}
          onSearch={(v) => navigate(`/search?q=${encodeURIComponent(v)}`)}
          placeholder="搜索项目、场景、报告或模板..."
          size="large"
          style={{ maxWidth: 560 }}
          enterButton
        />
        {q && <div className="search-meta">搜索 &ldquo;<strong>{q}</strong>&rdquo; · 共 {results.length} 个结果</div>}
      </div>

      {q && (
        <div className="search-type-filter">
          <Segmented
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as string)}
            options={[
              { label: `全部 (${typeCounts.all ?? 0})`, value: 'all' },
              { label: `项目 (${typeCounts.project ?? 0})`, value: 'project' },
              { label: `场景 (${typeCounts.scene ?? 0})`, value: 'scene' },
              { label: `报告 (${typeCounts.report ?? 0})`, value: 'report' },
              { label: `模板 (${typeCounts.template ?? 0})`, value: 'template' },
            ].filter((o) => typeCounts[o.value] > 0 || o.value === 'all')}
          />
        </div>
      )}

      <SectionCard title={q ? `结果列表` : '请输入搜索关键词'}>
        {!q.trim() ? (
          <div className="search-empty-initial">
            <div className="search-empty-icon">🔍</div>
            <p>在上方搜索框输入关键词开始搜索</p>
            <div className="search-suggest-tags">
              <span>试试：</span>
              {['电商', '冷链', 'AGV', '拥堵优化', '报告'].map((t) => (
                <Tag key={t} color="blue" style={{ cursor: 'pointer' }} onClick={() => navigate(`/search?q=${encodeURIComponent(t)}`)}>{t}</Tag>
              ))}
            </div>
          </div>
        ) : loading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : filtered.length === 0 ? (
          <div className="search-empty-result">
            <div className="search-empty-icon">📭</div>
            <p style={{ fontSize: 15, color: '#1f2937', fontWeight: 500 }}>没有找到匹配的结果</p>
            <p style={{ color: '#6b7280', marginBottom: 16 }}>试试换个关键词，或浏览推荐的搜索词</p>
            <Button icon={<HomeOutlined />} onClick={() => navigate('/')}>返回首页</Button>
          </div>
        ) : (
          <List
            dataSource={filtered}
            renderItem={(item) => (
              <div className="search-result-item" onClick={() => navigate(item.url)} role="button" tabIndex={0}>
                <span className="search-icon">{typeIcon[item.type]}</span>
                <div className="search-body">
                  <div className="search-item-title">
                    {highlightText(item.title, q)}
                    <Tag color={typeColor[item.type]} className="search-type-tag">{typeLabel[item.type]}</Tag>
                  </div>
                  <div className="search-item-desc">{highlightText(item.description, q)}</div>
                </div>
                <span className="search-arrow">&rarr;</span>
              </div>
            )}
          />
        )}
      </SectionCard>
    </div>
  );
}
