import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, DatePicker, Empty, Skeleton, Select, Slider, Space, Tabs, Tag } from 'antd';
import { CalendarOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EChart, KpiCard, ProjectContextBar, SectionCard } from '@/components';
import {
  useReportKpis,
  useReportTrend,
  useReportAnomalies,
  useReportAnomalyTotal,
  useReportSceneRankings,
  useReportFulfillment,
  useReportDeviceUsages,
  useReportLogPlayback,
  downloadReportPdf,
  useSimulationDetail,
} from '@/api/modules';
import './index.css';
import { useAppStore } from '@/stores/useAppStore';
import { useCan } from '@/utils/roleGuard';
import { getApiErrorMessage } from '@/api/errorMessage';

function formatPlaybackTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export default function Report() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storedSimulationId = useAppStore((state) => state.currentSimulationId);
  const simulationId = searchParams.get('simulationId') ?? storedSimulationId ?? '';
  const canExport = useCan('export_report');
  // ===== 领域 API 接入（传递 simulationId） =====
  const simulationQuery = useSimulationDetail(simulationId || undefined);
  const simProjectId = simulationQuery.data?.project_id ?? '';
  const simScenarioId = simulationQuery.data?.scenario_id ?? '';
  const kpisQuery = useReportKpis(simulationId || undefined);
  const trendQuery = useReportTrend(simulationId || undefined);
  const anomaliesQuery = useReportAnomalies(simulationId || undefined);
  const anomalyTotalQuery = useReportAnomalyTotal(simulationId || undefined);
  const rankingsQuery = useReportSceneRankings(simulationId || undefined);
  const fulfillmentQuery = useReportFulfillment(simulationId || undefined);
  const devicesQuery = useReportDeviceUsages(simulationId || undefined);
  const playbackQuery = useReportLogPlayback(simulationId || undefined);
  const reportQueries = [kpisQuery, trendQuery, anomaliesQuery, anomalyTotalQuery, rankingsQuery, fulfillmentQuery, devicesQuery, playbackQuery];
  const reportError = reportQueries.find((query) => query.isError)?.error;
  const kpisLoading = kpisQuery.isLoading;
  const anomaliesLoading = anomaliesQuery.isLoading;
  const rankingsLoading = rankingsQuery.isLoading;
  const devicesLoading = devicesQuery.isLoading;

  const kpis = kpisQuery.data ?? [];
  const trend = trendQuery.data ?? [];
  const anomalies = anomaliesQuery.data ?? [];
  const anomalyTotal = anomalyTotalQuery.data;
  const rankings = rankingsQuery.data ?? [];
  const fulfillment = fulfillmentQuery.data ?? [];
  const devices = devicesQuery.data ?? [];
  const playback = playbackQuery.data;
  const playbackFrames = playback?.frames ?? [];
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaybackRunning, setIsPlaybackRunning] = useState(false);
  const safePlaybackIndex = Math.min(playbackIndex, Math.max(playbackFrames.length - 1, 0));
  const playbackFrame = playbackFrames[safePlaybackIndex];

  useEffect(() => {
    if (!isPlaybackRunning || playbackFrames.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setPlaybackIndex((current) => {
        if (current >= playbackFrames.length - 1) {
          setIsPlaybackRunning(false);
          return current;
        }
        return current + 1;
      });
    }, 800 / playbackSpeed);
    return () => window.clearInterval(timer);
  }, [isPlaybackRunning, playbackFrames.length, playbackSpeed]);

  const handleDownload = async () => {
    if (!simulationId) {
      message.warning('缺少仿真 ID，无法导出报告');
      return;
    }
    if (!canExport) return message.warning('当前账号没有导出报告权限');
    try {
      const blob = await downloadReportPdf(simulationId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ican-report-${simulationId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success('报告已下载');
    } catch (error) {
      message.error(getApiErrorMessage(error, '报告下载失败'));
    }
  };

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
      grid: { left: 30, right: 50, top: 30, bottom: 50 },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', height: 18, bottom: 24 },
      ],
      xAxis: {
        type: 'category',
        data: trend.map((d) => d.date),
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '完成率/拥堵率 (%)',
          position: 'left',
          splitLine: { lineStyle: { color: '#f3f4f6' } },
        },
        { type: 'value', name: '能耗 (kWh/件)', position: 'right', splitLine: { show: false } },
      ],
      series: [
        {
          name: '完成率 (%)',
          type: 'line',
          smooth: true,
          data: trend.map((d) => d.completionRate),
          lineStyle: { color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
          symbol: 'circle',
          symbolSize: 5,
        },
        {
          name: '拥堵率 (%)',
          type: 'line',
          smooth: true,
          data: trend.map((d) => d.congestionRate),
          lineStyle: { color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
          symbol: 'circle',
          symbolSize: 5,
        },
        {
          name: '能耗 (kWh/件)',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          data: trend.map((d) => d.energy),
          lineStyle: { color: '#22c55e' },
          itemStyle: { color: '#22c55e' },
          symbol: 'circle',
          symbolSize: 5,
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trend],
  );

  const pieOption = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c} ({d}%)' },
      series: [
        {
          type: 'pie',
          radius: ['55%', '78%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          data: anomalies.map((a) => ({
            name: a.type,
            value: a.count,
            itemStyle: { color: a.color },
          })),
        },
        {
          type: 'pie',
          radius: ['0%', '40%'],
          center: ['50%', '50%'],
          silent: true,
          label: {
            position: 'center',
            formatter: `{a|异常总数}\n{b|${anomalyTotal ?? 0}}\n{c|次}`,
            rich: {
              a: { fontSize: 12, color: '#9ca3af', lineHeight: 18 },
              b: { fontSize: 22, color: '#1f2937', fontWeight: 600, lineHeight: 28 },
              c: { fontSize: 11, color: '#9ca3af' },
            },
          },
          data: [{ value: 1, itemStyle: { color: 'transparent' } }],
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anomalies, anomalyTotal],
  );

  const fulfillmentOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { fontSize: 12 } },
      grid: { left: 40, right: 20, top: 20, bottom: 36 },
      xAxis: { type: 'category', data: fulfillment.map((d) => d.date) },
      yAxis: { type: 'value' },
      series: [
        {
          name: '准时完成',
          type: 'bar',
          stack: 'a',
          data: fulfillment.map((d) => d.onTime),
          itemStyle: { color: '#3b82f6' },
          barWidth: 20,
        },
        {
          name: '延迟完成',
          type: 'bar',
          stack: 'a',
          data: fulfillment.map((d) => d.delayed),
          itemStyle: { color: '#f59e0b' },
          barWidth: 20,
        },
        {
          name: '未完成',
          type: 'bar',
          stack: 'a',
          data: fulfillment.map((d) => d.unfinished),
          itemStyle: { color: '#e5e7eb' },
          barWidth: 20,
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fulfillment],
  );

  if (!simulationId) {
    return <div className="report-page" style={{ padding: 40 }}><Empty description="尚未选择仿真运行"><p>运行报告必须关联真实 simulationId，请先完成一次仿真。</p><Button type="primary" onClick={() => navigate('/simulation')}>进入仿真空间</Button></Empty></div>;
  }

  if (reportError) {
    return <div className="report-page" style={{ padding: 40 }}><Alert type="error" showIcon message="运行报告加载失败" description={getApiErrorMessage(reportError, '报告数据不存在、无权访问或后端未启动')} action={<Space><Button onClick={() => reportQueries.forEach((query) => void query.refetch())}>重试</Button><Button onClick={() => navigate(`/simulation?simulationId=${encodeURIComponent(simulationId)}`)}>返回仿真</Button></Space>} /></div>;
  }

  return (
    <div className="report-page">
      {simProjectId && (
        <ProjectContextBar
          projectId={simProjectId}
          scenarioId={simScenarioId}
          simulationId={simulationId}
        />
      )}
      {/* Header */}
      <div className="report-header">
        <h1 className="report-title">运行报告 / 数据洞察</h1>
        <div className="report-filters">
          <div className="filter-item">
            <span className="filter-label">项目筛选</span>
            <Select
              defaultValue="current"
              style={{ width: 180 }}
              disabled
              options={[{ value: 'current', label: '当前仿真运行' }]}
            />
          </div>
          <div className="filter-item">
            <span className="filter-label">场景类型</span>
            <Select
              defaultValue="all"
              style={{ width: 140 }}
              disabled
              options={[{ value: 'all', label: '当前场景' }]}
            />
          </div>
          <div className="filter-item">
            <span className="filter-label">时间范围</span>
            <DatePicker.RangePicker disabled />
          </div>
          <div className="filter-item">
            <span className="filter-label">运行版本</span>
            <Select
              defaultValue="all"
              style={{ width: 140 }}
              disabled
              options={[{ value: 'all', label: '当前版本' }]}
            />
          </div>
          <Button type="primary" icon={<DownloadOutlined />} disabled={!canExport} onClick={() => void handleDownload()}>
            导出报告
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-row">
        {kpisLoading ? (
          <Skeleton active paragraph={{ rows: 1 }} />
        ) : (
          kpis.map((k) => <KpiCard key={k.title} data={k} />)
        )}
      </div>

      {/* 趋势 + 异常 */}
      <div className="report-row">
        <SectionCard
          title="运行趋势"
          extra={
            <Tabs
              defaultActiveKey="day"
              items={[
                { key: 'day', label: '按天聚合' },
                { key: 'week', label: '按周聚合' },
                { key: 'month', label: '按月聚合' },
              ]}
            />
          }
        >
          <EChart option={trendOption} height={320} />
        </SectionCard>

        <SectionCard
          title="异常分布"
          extra={
            <a>
              查看明细 <CalendarOutlined />
            </a>
          }
        >
          <div className="anomaly-layout">
            <div className="anomaly-chart">
              <EChart option={pieOption} height={240} />
            </div>
            <div className="anomaly-legend">
              {anomaliesLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : (
                anomalies.map((a) => (
                  <div key={a.type} className="anomaly-row">
                    <span className="anomaly-dot" style={{ background: a.color }} />
                    <span className="anomaly-type">{a.type}</span>
                    <span className="anomaly-count num-font">{a.count}</span>
                    <span className="anomaly-percent num-font">{a.percent}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 场景排行 */}
      <SectionCard
        title="场景表现排行"
        extra={
          <Select
            defaultValue="completion"
            disabled
            style={{ width: 140 }}
            options={[
              { value: 'completion', label: '按完成率' },
              { value: 'congestion', label: '按拥堵率' },
              { value: 'energy', label: '按能耗' },
            ]}
          />
        }
      >
        <div className="ranking-table">
          <div className="ranking-header">
            <div>排名</div>
            <div>场景</div>
            <div>完成率</div>
            <div>拥堵率</div>
            <div>能耗 (kWh/件)</div>
          </div>
          {rankingsLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : (
            rankings.map((r) => (
              <div key={r.rank} className="ranking-row">
                <div>
                  <span className={`rank-badge rank-${r.rank}`}>{r.rank}</span>
                </div>
                <div className="scene-name">{r.scene}</div>
                <div className="bar-cell">
                  <div className="bar-bg">
                    <div
                      className="bar-fill"
                      style={{ width: `${r.completionRate}%`, background: '#3b82f6' }}
                    />
                  </div>
                  <span className="bar-val num-font">{r.completionRate}%</span>
                </div>
                <div className="num-font">{r.congestionRate}%</div>
                <div className="num-font">{r.energy}</div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      {/* 履约 + 设备 + 日志 */}
      <div className="report-row-3">
        <SectionCard
          title="订单履约分析"
          extra={
            <Select
              defaultValue="day"
              disabled
              style={{ width: 120 }}
              options={[{ value: 'day', label: '按日聚合' }]}
            />
          }
        >
          <EChart option={fulfillmentOption} height={260} />
        </SectionCard>

        <SectionCard
          title="设备利用明细"
          extra={
            <Tabs
              defaultActiveKey="agv"
              items={[
                { key: 'agv', label: 'AGV' },
                { key: 'arm', label: '机械臂' },
              ]}
            />
          }
        >
          <div className="device-table">
            <div className="device-header">
              <div>设备类型</div>
              <div>设备编号</div>
              <div>利用率</div>
              <div>行驶里程(km)</div>
              <div>任务数</div>
              <div>故障次数</div>
            </div>
            {devicesLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              devices.map((d) => (
                <div key={d.deviceId} className="device-row">
                  <div>
                    <Tag color="cyan">{d.type}</Tag>
                  </div>
                  <div className="num-font">{d.deviceId}</div>
                  <div>
                    <div className="util-bar">
                      <div
                        className="util-fill"
                        style={{
                          width: `${d.utilization}%`,
                          background:
                            d.utilization > 75
                              ? '#22c55e'
                              : d.utilization > 60
                                ? '#f59e0b'
                                : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="util-val num-font">{d.utilization}%</span>
                  </div>
                  <div className="num-font">{d.mileage}</div>
                  <div className="num-font">{d.tasks.toLocaleString()}</div>
                  <div className="num-font">{d.faults}</div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title={`日志回放`}
          extra={
            <span>
              运行 ID: {playback?.runId ?? '—'} · {playback?.frameCount ?? 0} 帧
            </span>
          }
        >
          <div className="playback">
            <div className="playback-video">
              <div className="video-cover">
                {playbackFrame ? (
                  <>
                    <div className="playback-frame-summary">
                      <strong>仓内状态帧 · T+{playbackFrame.time}s</strong>
                      <span>
                        任务 {playbackFrame.tasks.completed}/{playbackFrame.tasks.total} ·
                        完成率 {Math.round((playbackFrame.metrics.completion_rate ?? 0) * 100)}%
                      </span>
                    </div>
                    <div className="playback-robots">
                      {playbackFrame.robots.slice(0, 8).map((robot) => (
                        <div key={robot.id} className={`playback-robot ${robot.state !== 'idle' ? 'is-active' : ''}`}>
                          <span className="robot-dot" />
                          <strong>{robot.id.toUpperCase()}</strong>
                          <span>{robot.state}</span>
                          <small>({robot.x.toFixed(0)}, {robot.y.toFixed(0)}) · {robot.battery}%</small>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该运行尚无可回放状态帧" />
                )}
                <span className="video-time num-font">
                  {formatPlaybackTime(playbackFrame?.time ?? 0)} / {playback?.totalDuration ?? '00:00:00'}
                </span>
              </div>
            </div>
            <div className="playback-controls">
              <Button
                size="small"
                type="text"
                aria-label={isPlaybackRunning ? '暂停回放' : '开始回放'}
                disabled={playbackFrames.length < 2}
                icon={<span>{isPlaybackRunning ? '⏸' : '▶'}</span>}
                onClick={() => {
                  if (safePlaybackIndex >= playbackFrames.length - 1) setPlaybackIndex(0);
                  setIsPlaybackRunning((running) => !running);
                }}
              />
              <Button
                size="small"
                type="text"
                aria-label="下一帧"
                disabled={safePlaybackIndex >= playbackFrames.length - 1}
                icon={<span>⏭</span>}
                onClick={() => setPlaybackIndex((index) => Math.min(index + 1, playbackFrames.length - 1))}
              />
              <Select
                size="small"
                value={playbackSpeed}
                style={{ width: 80 }}
                onChange={setPlaybackSpeed}
                options={[
                  { value: 0.5, label: '0.5x' },
                  { value: 1, label: '1.0x' },
                  { value: 2, label: '2.0x' },
                ]}
              />
              <div className="playback-progress">
                <Slider
                  min={0}
                  max={Math.max(playbackFrames.length - 1, 0)}
                  value={safePlaybackIndex}
                  disabled={playbackFrames.length < 2}
                  tooltip={{ formatter: (index) => `第 ${(index ?? 0) + 1} 帧` }}
                  onChange={(index) => {
                    setIsPlaybackRunning(false);
                    setPlaybackIndex(index);
                  }}
                />
              </div>
            </div>
            <div className="playback-events">
              {(playback?.events ?? []).map((e, i) => (
                <div key={i} className="playback-event">
                  <span className="event-time num-font">{e.time}</span>
                  <span className="event-dot" style={{ background: e.color }} />
                  <span className="event-label">{e.label}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
