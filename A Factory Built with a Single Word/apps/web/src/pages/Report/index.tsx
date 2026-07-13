import { useMemo } from 'react';
import { App, Button, DatePicker, Skeleton, Select, Tabs, Tag } from 'antd';
import { CalendarOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EChart, KpiCard, SectionCard } from '@/components';
import {
  useReportKpis,
  useReportTrend,
  useReportAnomalies,
  useReportAnomalyTotal,
  useReportSceneRankings,
  useReportFulfillment,
  useReportDeviceUsages,
  useReportLogPlayback,
} from '@/api/modules';
import './index.css';

export default function Report() {
  const { message } = App.useApp();
  // ===== 领域 API 接入 =====
  const { data: kpisData, isLoading: kpisLoading } = useReportKpis();
  const { data: trendData, isLoading: _trendLoading } = useReportTrend();
  const { data: anomaliesData, isLoading: anomaliesLoading } = useReportAnomalies();
  const { data: anomalyTotal } = useReportAnomalyTotal();
  const { data: rankingsData, isLoading: rankingsLoading } = useReportSceneRankings();
  const { data: fulfillmentData, isLoading: _fulfillmentLoading } = useReportFulfillment();
  const { data: devicesData, isLoading: devicesLoading } = useReportDeviceUsages();
  const { data: playbackData, isLoading: _playbackLoading } = useReportLogPlayback();

  const kpis = kpisData ?? [];
  const trend = trendData ?? [];
  const anomalies = anomaliesData ?? [];
  const rankings = rankingsData ?? [];
  const fulfillment = fulfillmentData ?? [];
  const devices = devicesData ?? [];
  const playback = playbackData;

  const trendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 4, textStyle: { fontSize: 12 } },
      grid: { left: 30, right: 50, top: 30, bottom: 50 },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', height: 18, bottom: 24 }],
      xAxis: { type: 'category', data: trend.map((d) => d.date), axisLine: { lineStyle: { color: '#e5e7eb' } } },
      yAxis: [
        { type: 'value', name: '完成率/拥堵率 (%)', position: 'left', splitLine: { lineStyle: { color: '#f3f4f6' } } },
        { type: 'value', name: '能耗 (kWh/件)', position: 'right', splitLine: { show: false } },
      ],
      series: [
        { name: '完成率 (%)', type: 'line', smooth: true, data: trend.map((d) => d.completionRate), lineStyle: { color: '#3b82f6' }, itemStyle: { color: '#3b82f6' }, symbol: 'circle', symbolSize: 5 },
        { name: '拥堵率 (%)', type: 'line', smooth: true, data: trend.map((d) => d.congestionRate), lineStyle: { color: '#f59e0b' }, itemStyle: { color: '#f59e0b' }, symbol: 'circle', symbolSize: 5 },
        { name: '能耗 (kWh/件)', type: 'line', smooth: true, yAxisIndex: 1, data: trend.map((d) => d.energy), lineStyle: { color: '#22c55e' }, itemStyle: { color: '#22c55e' }, symbol: 'circle', symbolSize: 5 },
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
          data: anomalies.map((a) => ({ name: a.type, value: a.count, itemStyle: { color: a.color } })),
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
        { name: '准时完成', type: 'bar', stack: 'a', data: fulfillment.map((d) => d.onTime), itemStyle: { color: '#3b82f6' }, barWidth: 20 },
        { name: '延迟完成', type: 'bar', stack: 'a', data: fulfillment.map((d) => d.delayed), itemStyle: { color: '#f59e0b' }, barWidth: 20 },
        { name: '未完成', type: 'bar', stack: 'a', data: fulfillment.map((d) => d.unfinished), itemStyle: { color: '#e5e7eb' }, barWidth: 20 },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fulfillment],
  );

  return (
    <div className="report-page">
      {/* Header */}
      <div className="report-header">
        <h1 className="report-title">运行报告 / 数据洞察</h1>
        <div className="report-filters">
          <div className="filter-item">
            <span className="filter-label">项目筛选</span>
            <Select defaultValue="ecom-2" style={{ width: 180 }} options={[{ value: 'ecom-2', label: '电商华南枢纽二期' }]} />
          </div>
          <div className="filter-item">
            <span className="filter-label">场景类型</span>
            <Select defaultValue="all" style={{ width: 140 }} options={[{ value: 'all', label: '全部场景' }]} />
          </div>
          <div className="filter-item">
            <span className="filter-label">时间范围</span>
            <DatePicker.RangePicker defaultValue={[dayjs('2025-05-01'), dayjs('2025-05-31')]} />
          </div>
          <div className="filter-item">
            <span className="filter-label">运行版本</span>
            <Select defaultValue="all" style={{ width: 140 }} options={[{ value: 'all', label: '全部版本' }]} />
          </div>
          <Button type="primary" icon={<DownloadOutlined />} onClick={() => message.loading('正在导出报告...', 1.2).then(() => message.success('报告已导出（演示）'))}>导出报告</Button>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-row">
        {kpisLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : kpis.map((k) => (
          <KpiCard key={k.title} data={k} />
        ))}
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
              {anomaliesLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : anomalies.map((a) => (
                <div key={a.type} className="anomaly-row">
                  <span className="anomaly-dot" style={{ background: a.color }} />
                  <span className="anomaly-type">{a.type}</span>
                  <span className="anomaly-count num-font">{a.count}</span>
                  <span className="anomaly-percent num-font">{a.percent}%</span>
                </div>
              ))}
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
          {rankingsLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : rankings.map((r) => (
            <div key={r.rank} className="ranking-row">
              <div>
                <span className={`rank-badge rank-${r.rank}`}>{r.rank}</span>
              </div>
              <div className="scene-name">{r.scene}</div>
              <div className="bar-cell">
                <div className="bar-bg">
                  <div className="bar-fill" style={{ width: `${r.completionRate}%`, background: '#3b82f6' }} />
                </div>
                <span className="bar-val num-font">{r.completionRate}%</span>
              </div>
              <div className="num-font">{r.congestionRate}%</div>
              <div className="num-font">{r.energy}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 履约 + 设备 + 日志 */}
      <div className="report-row-3">
        <SectionCard title="订单履约分析" extra={<Select defaultValue="day" style={{ width: 120 }} options={[{ value: 'day', label: '按日聚合' }]} />}>
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
            {devicesLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : devices.map((d) => (
              <div key={d.deviceId} className="device-row">
                <div><Tag color="cyan">{d.type}</Tag></div>
                <div className="num-font">{d.deviceId}</div>
                <div>
                  <div className="util-bar">
                    <div className="util-fill" style={{ width: `${d.utilization}%`, background: d.utilization > 75 ? '#22c55e' : d.utilization > 60 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <span className="util-val num-font">{d.utilization}%</span>
                </div>
                <div className="num-font">{d.mileage}</div>
                <div className="num-font">{d.tasks.toLocaleString()}</div>
                <div className="num-font">{d.faults}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={`日志回放`}
          extra={
            <span>
              运行 ID: {playback?.runId ?? '—'} · <a>详情</a>
            </span>
          }
        >
          <div className="playback">
            <div className="playback-video">
              <div className="video-cover">
                <div className="play-btn">▶</div>
                <span className="video-time num-font">00:06:42 / 00:15:20</span>
              </div>
            </div>
            <div className="playback-controls">
              <Button size="small" type="text" icon={<span>▶</span>} />
              <Button size="small" type="text" icon={<span>⏭</span>} />
              <Select size="small" defaultValue="1.0x" style={{ width: 80 }} options={[{ value: '1.0x', label: '1.0x' }]} />
              <div className="playback-progress">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: '43%' }} />
                  <div className="progress-thumb" style={{ left: '43%' }} />
                </div>
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
