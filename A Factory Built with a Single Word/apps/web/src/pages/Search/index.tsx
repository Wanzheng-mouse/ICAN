import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Empty, Input, List, Spin, Tag } from 'antd';
import { FolderOutlined, ExperimentOutlined, FundOutlined, AppstoreOutlined } from '@ant-design/icons';
import { SectionCard } from '@/components';
import { searchIndex, type SearchResult } from '@/stores/searchIndex';
import './Search.css';

const typeIcon: Record<string, React.ReactNode> = {
  project: <FolderOutlined />,
  scene: <AppstoreOutlined />,
  report: <FundOutlined />,
  template: <ExperimentOutlined />,
};

const typeColor: Record<string, string> = {
  project: 'blue', scene: 'green', report: 'purple', template: 'gold',
};
const typeLabel: Record<string, string> = {
  project: '项目', scene: '场景', report: '报告', template: '模板',
};

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setInput(q);
    setSearching(Boolean(q.trim()));
    const timer = setTimeout(() => {
      setResults(searchIndex(q));
      setSearching(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const submitSearch = (value: string) => {
    const normalized = value.trim();
    navigate(normalized ? `/search?q=${encodeURIComponent(normalized)}` : '/search');
  };

  return (
    <div className="search-page">
      <div className="search-header">
        <h1 className="search-title">搜索结果</h1>
        <Input.Search
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onSearch={submitSearch}
          placeholder="搜索项目、场景、报告或模板..."
          size="large"
          style={{ maxWidth: 520 }}
          enterButton
        />
      </div>
      <SectionCard title={q ? `找到 ${results.length} 个结果` : '请输入搜索关键词'}>
        {searching ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
        ) : results.length === 0 ? (
          <Empty description={q ? '没有找到匹配的结果，请换个关键词试试' : '在上方搜索框输入关键词开始搜索'} />
        ) : (
          <List
            dataSource={results}
            renderItem={(item) => (
              <div className="search-result-item" onClick={() => navigate(item.url)}>
                <span className="search-icon">{typeIcon[item.type]}</span>
                <div className="search-body">
                  <div className="search-item-title">
                    {item.title}
                    <Tag color={typeColor[item.type]} style={{ marginLeft: 8, fontSize: 10 }}>{typeLabel[item.type]}</Tag>
                  </div>
                  <div className="search-item-desc">{item.description}</div>
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
