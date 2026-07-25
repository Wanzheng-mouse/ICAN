import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CodeOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileZipOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Empty, Segmented, Skeleton, Space, Tag } from 'antd';
import { EChart, ProjectContextBar, SectionCard } from '@/components';
import { applyEvolution, downloadReportPdf, useEvolution, useEvolutionReport, useEvolutionTrend, useSimulationDetail } from '@/api/modules';
import { evolutionExportOptions } from '@/config/evolutionExports';
import type { EvolutionMetricDiff, EvolutionVersion } from '@ican/contracts';
import { useAppStore } from '@/stores/useAppStore';
import { getApiErrorMessage } from '@/api/errorMessage';
import { useCan } from '@/utils/roleGuard';
import './index.css';

const exportIconMap: Record<string, React.ReactNode> = {
  FilePdfOutlined: <FilePdfOutlined />,
  FilePptOutlined: <FilePptOutlined />,
  PlayCircleOutlined: <PlayCircleOutlined />,
  FileZipOutlined: <FileZipOutlined />,
  CodeOutlined: <CodeOutlined />,
};

const riskColorMap = { high: 'red', medium: 'orange', low: 'blue' } as const;
const riskTextMap = { high: '高风险', medium: '中风险', low: '低风险' } as const;

export default function Evolution() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storedEvolutionId = useAppStore((state) => state.currentEvolutionId);
  const storedSimulationId = useAppStore((state) => state.currentSimulationId);
  const setProjectContext = useAppStore((state) => state.setProjectContext);
  const canExport = useCan('export_report');
  const canApply = useCan('trigger_evolution');
  const evolutionId = searchParams.get('evolutionId') ?? storedEvolutionId ?? '';
  const { data: reportData, isLoading: reportLoading, isError: reportError, error: reportErrorValue, refetch: refetchReport } = useEvolutionReport(
    evolutionId || undefined,
  );
  const { data: trendData, isLoading: _trendLoading } = useEvolutionTrend(evolutionId || undefined);
  const initialSimId = searchParams.get('simulationId') ?? storedSimulationId ?? '';
  const { data: evolutionRead } = useEvolution(evolutionId || undefined);
  const resolvedSimulationId = evolutionRead?.simulation_id ?? initialSimId;
  const simDetailQuery = useSimulationDetail(resolvedSimulationId || undefined);
  const simProjectId = simDetailQuery.data?.project_id ?? '';
  const simScenarioId = simDetailQuery.data?.scenario_id ?? '';

  // 用一个空占位让初次加载不至于崩溃
  const report = reportData;
  const trend = trendData ?? [];

  const [activeVersion, setActiveVersion] = useState<string>(
    report?.versions.find((v) => v.isCurrent)?.version ??
      report?.versions[report.versions.length - 1]?.version ??
      'v2.0',
  );
  const [trendMode, setTrendMode] = useState<'version' | 'metric'>('version');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!report) return;
    setActiveVersion(
      report.versions.find((version) => version.isCurrent)?.version ??
      report.versions.at(-1)?.version ??
      'v1.0',
    );
  }, [report]);

  // 根据选中的版本过滤指标和趋势
  const versionIndex = report?.versions.findIndex((v) => v.version === activeVersion) ?? 0;
  const currentMetrics: EvolutionMetricDiff[] = useMemo(() => {
    if (!report) return [];
    return report.metrics.map((m, i) => {
      const ratio = (versionIndex + 1) / report.versions.length;
      return {
        ...m,
        before:
          i === 0
            ? m.before
            : Math.round((m.before - (m.before - m.after) * (1 - ratio)) * 10) / 10,
        after: Math.round((m.before - (m.before - m.after) * ratio) * 10) / 10,
        delta: Math.round(((m.before - (m.before - m.after) * ratio) / m.before) * 1000) / 10,
      };
    });
  }, [versionIndex, report]);

  const trendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: {
        bottom: 0,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 4,
        textStyle: { fontSize: 12 },
      },
      grid: { left: 30, right: 30, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: trend.map((d) => d.version),
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '率 %',
          position: 'left',
          splitLine: { lineStyle: { color: '#f3f4f6' } },
        },
        { type: 'value', name: '次/时', position: 'right', splitLine: { show: false } },
      ],
      series: trendMode === 'version' ? [
        {
          name: '完成时长(分钟)',
          type: 'line',
          smooth: true,
          data: trend.map((d) => 142.6 - d.completion * 0.5),
          lineStyle: { color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
          symbol: 'circle',
          symbolSize: 6,
        },
        {
          name: '空驶率(%)',
          type: 'line',
          smooth: true,
          data: trend.map((d) => d.emptyRate),
          lineStyle: { color: '#22c55e' },
          itemStyle: { color: '#22c55e' },
          symbol: 'circle',
          symbolSize: 6,
        },
        {
          name: '拥堵次数(次/小时)',
          type: 'line',
          smooth: true,
          data: trend.map((d) => d.congestion),
          lineStyle: { color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
          symbol: 'circle',
          symbolSize: 6,
          yAxisIndex: 1,
        },
        {
          name: '能耗(kWh/小时)',
          type: 'line',
          smooth: true,
          data: trend.map((d) => d.energy),
          lineStyle: { color: '#a855f7' },
          itemStyle: { color: '#a855f7' },
          symbol: 'circle',
          symbolSize: 6,
        },
        {
          name: '订单完成率(%)',
          type: 'line',
          smooth: true,
          data: trend.map((d) => d.completion),
          lineStyle: { color: '#06b6d4' },
          itemStyle: { color: '#06b6d4' },
          symbol: 'circle',
          symbolSize: 6,
        },
      ] : [
        { name: '空驶率(%)', type: 'bar', data: trend.map((d) => d.emptyRate), itemStyle: { color: '#22c55e' } },
        { name: '拥堵次数', type: 'bar', data: trend.map((d) => d.congestion), itemStyle: { color: '#f59e0b' }, yAxisIndex: 1 },
        { name: '能耗(kWh/小时)', type: 'line', smooth: true, data: trend.map((d) => d.energy), itemStyle: { color: '#a855f7' }, lineStyle: { color: '#a855f7' } },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trend, trendMode],
  );

  if (!evolutionId) {
    return <div className="evolution-page" style={{ padding: 40 }}><Empty description="尚未生成进化分析"><p>请先运行仿真，再从仿真空间创建进化分析。</p><Button type="primary" onClick={() => navigate(resolvedSimulationId ? `/simulation?simulationId=${encodeURIComponent(resolvedSimulationId)}` : '/projects')}>返回仿真</Button></Empty></div>;
  }
  if (reportLoading) {
    return (
      <div className="evolution-page" style={{ padding: 40 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }
  if (reportError) {
    return <div className="evolution-page" style={{ padding: 40 }}><Alert type="error" showIcon message="进化结果加载失败" description={getApiErrorMessage(reportErrorValue, '进化记录不存在、无权访问或后端未启动')} action={<Space><Button onClick={() => void refetchReport()}>重试</Button><Button onClick={() => navigate('/projects')}>项目中心</Button></Space>} /></div>;
  }
  if (!report) {
    return (
      <div className="evolution-page" style={{ padding: 40 }}>
        暂无数据
      </div>
    );
  }

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    message.success('报告链接已复制到剪贴板');
  };

  const handleExport = async (key: string) => {
    if (!canExport) return message.warning('当前账号没有导出报告权限');
    if (key === 'json') {
      if (!report) return message.warning('进化报告尚未加载完成');
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ican-evolution-${evolutionId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success('JSON 策略包已下载');
      return;
    }
    if (!resolvedSimulationId) return message.warning('缺少关联仿真 ID，无法生成报告');
    try {
      const blob = await downloadReportPdf(resolvedSimulationId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ican-evolution-${evolutionId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success('PDF 报告已下载');
    } catch (error) {
      message.error(getApiErrorMessage(error, 'PDF 报告下载失败'));
    }
  };

  const handleApplyEvolution = async () => {
    if (!canApply) return message.warning('当前账号没有应用进化方案的权限');
    setApplying(true);
    try {
      const result = await applyEvolution(evolutionId);
      setProjectContext({
        projectId: result.project_id,
        scenarioId: result.scenario.id,
        simulationId: resolvedSimulationId || undefined,
        evolutionId,
      });
      message.success(`已生成新场景：${result.scenario.name}`);
      navigate(`/editor?projectId=${encodeURIComponent(result.project_id)}&scenarioId=${encodeURIComponent(result.scenario.id)}`);
    } catch (error) {
      message.error(getApiErrorMessage(error, '进化方案应用失败'));
    } finally {
      setApplying(false);
    }
  };

  const handleVersionClick = (v: EvolutionVersion) => {
    setActiveVersion(v.version);
    message.info(`已切换到 ${v.version} ${v.label}`);
  };

  return (
    <div className="evolution-page">
      {simProjectId && (
        <ProjectContextBar
          projectId={simProjectId}
          scenarioId={simScenarioId}
          simulationId={resolvedSimulationId}
        />
      )}
      <div className="evo-header">
        <div className="evo-header-left">
          <h1 className="evo-title">
            方案进化报告：{report.title.replace('方案进化报告：', '')}
            <Tag color="success" icon={<CheckOutlined />} className="evo-status">
              进化完成
            </Tag>
          </h1>
          <div className="evo-meta">
            <span>生成时间：{report.generatedAt}</span>
            <span className="dot">·</span>
            <span>
              当前版本：<b style={{ color: '#2b6fff' }}>{activeVersion}</b>
            </span>
            <span className="dot">·</span>
            <span>场景类型：电商仓</span>
            <span className="dot">·</span>
            <span>规模：{report.scale}</span>
          </div>
        </div>
        <div className="evo-header-right">
          <Button icon={<ShareAltOutlined />} onClick={handleShare}>
            分享
          </Button>
          <Button icon={<FilePdfOutlined />} disabled={!canExport} onClick={() => void handleExport('pdf')}>
            导出报告
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => navigate(resolvedSimulationId ? `/simulation?simulationId=${encodeURIComponent(resolvedSimulationId)}` : '/simulation')}>返回仿真</Button>
          <Button type="primary" icon={<RocketOutlined />} disabled={!canApply} loading={applying} onClick={() => void handleApplyEvolution()}>应用为新场景</Button>
        </div>
      </div>

      <SectionCard
        title={`优化前后对比（${activeVersion}）`}
        tooltip="显示关键指标在进化前后的对比"
        className="evo-section"
      >
        <div className="metric-grid">
          {currentMetrics.map((m) => (
            <div key={m.metric} className="metric-card">
              <div className="metric-name">{m.metric}</div>
              <div className="metric-unit">{m.unit}</div>
              <div className="metric-chart">
                <div className="bar before">
                  <div className="bar-label">优化前</div>
                  <div className="bar-value num-font">{m.before}</div>
                </div>
                <div className="bar after">
                  <div className="bar-label">优化后</div>
                  <div className="bar-value num-font" style={{ color: '#2b6fff' }}>
                    {m.after}
                  </div>
                </div>
              </div>
              <div className={`metric-delta ${m.isImprovement ? 'up' : 'down'}`}>
                {m.isImprovement ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                <span className="num-font">{m.delta.toFixed(1)}%</span>
                <span className="delta-label">{m.isImprovement ? '提升' : '降低'}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="evo-3col">
        <SectionCard
          title={`问题发现（共发现 ${report.issues.length} 个问题）`}
          extra={<a>查看详情</a>}
        >
          <div className="issue-list">
            {report.issues.map((iss, idx) => (
              <div key={idx} className="issue-row">
                <Tag color={riskColorMap[iss.level]}>{riskTextMap[iss.level]}</Tag>
                <div className="issue-body">
                  <div className="issue-title">{iss.title}</div>
                  <div className="issue-desc">{iss.description}</div>
                  <div className="issue-found">发现于 {iss.foundIn}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={`系统优化动作（共 ${report.actions.length} 项）`}
          extra={<a>查看详情</a>}
        >
          <div className="action-list">
            {report.actions.map((act, idx) => (
              <div key={idx} className="action-row">
                <CheckCircleFilled style={{ color: '#22c55e', fontSize: 16 }} />
                <div className="action-body">
                  <div className="action-title">{act.title}</div>
                  <div className="action-desc">{act.description}</div>
                </div>
                <Tag color={act.applied ? 'success' : 'processing'}>{act.applied ? '已应用' : '待应用'}</Tag>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="进化版本时间线" extra={<a>版本对比</a>}>
          <div className="timeline">
            {report.versions.map((v) => (
              <div
                key={v.version}
                className={`timeline-item ${v.isCurrent ? 'current' : ''} ${activeVersion === v.version ? 'active' : ''}`}
                onClick={() => handleVersionClick(v)}
                style={{ cursor: 'pointer' }}
              >
                <div className="timeline-dot" />
                <div className="timeline-body">
                  <div className="timeline-version">
                    {v.version}{' '}
                    {v.isCurrent && (
                      <Tag color="success" style={{ marginLeft: 4, fontSize: 10 }}>
                        当前
                      </Tag>
                    )}
                  </div>
                  <div className="timeline-label">{v.label}</div>
                  <div className="timeline-desc">{v.description}</div>
                  <div className="timeline-time num-font">{v.time}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="evo-2col">
        <SectionCard
          title="关键指标趋势"
          extra={
            <Segmented
              size="small"
              value={trendMode}
              onChange={(v) => setTrendMode(v as 'version' | 'metric')}
              options={[
                { label: '按版本对比', value: 'version' },
                { label: '按指标', value: 'metric' },
              ]}
            />
          }
        >
          <EChart option={trendOption} height={320} />
        </SectionCard>

        <SectionCard title="报告导出">
          <div className="export-grid">
            {evolutionExportOptions.map((opt) => (
              <div key={opt.key} className="export-card">
                <div
                  className="export-icon"
                  style={{ color: opt.color, background: `${opt.color}18` }}
                >
                  {exportIconMap[opt.icon]}
                </div>
                <div className="export-info">
                  <div className="export-label">{opt.label}</div>
                  <div className="export-desc">{opt.description}</div>
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<DownloadOutlined />}
                  className="export-btn"
                  disabled={!canExport}
                  onClick={() => void handleExport(opt.key)}
                >
                  导出 {opt.label.match(/[A-Z]+/g)?.[0] ?? opt.label}
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
