import type { EditableFieldDef, EditableValues } from '@/hooks/useEditableFields';

/**
 * 7 个索引页面的可编辑字段配置
 *
 * 设计原则：
 * - 每个页面 1 张 page-level 卡片（页面设置/偏好/显示选项）
 * - 表格类页面再追加一组 row-level 字段（行内 "设置" 按钮触发）
 * - 字段命名统一为业务术语，key 用 snake_case 与后端/契约一致
 *
 * localStorage 命名空间：ican.editable::${storageKey}::${variant}
 */

export interface PageFieldBundle {
  storageKey: string;
  title: string;
  eyebrow: string;
  description: string;
  fields: EditableFieldDef[];
  initial: EditableValues;
}

export interface RowFieldBundle {
  fields: EditableFieldDef[];
  initial: EditableValues;
  title: string;
}

// ---------- 1. 任务管理 ----------
export const TASKS_PAGE_FIELDS: PageFieldBundle = {
  storageKey: 'simulation::tasks::page',
  title: '任务查看偏好',
  eyebrow: 'PAGE PREFERENCES',
  description: '控制下方任务列表的过滤与自动重派策略。修改后立即生效，保存到本地。',
  fields: [
    {
      key: 'view_filter',
      label: '列表过滤',
      type: 'select',
      options: [
        { value: 'all', label: '全部任务' },
        { value: 'running', label: '仅进行中' },
        { value: 'completed', label: '仅已完成' },
        { value: 'failed', label: '仅已失败' },
      ],
    },
    {
      key: 'auto_reassign',
      label: '失败自动重派',
      type: 'select',
      options: [
        { value: 'enabled', label: '启用' },
        { value: 'disabled', label: '禁用' },
      ],
    },
    {
      key: 'priority_threshold',
      label: '高优先级阈值',
      type: 'number',
      min: 1,
      max: 100,
      hint: '评分高于此阈值的任务会自动标为 high',
    },
    {
      key: 'sticky_note',
      label: '团队备注',
      type: 'textarea',
      width: 'full',
      placeholder: '例如：晚高峰优先处理 inbound',
    },
  ],
  initial: {
    view_filter: 'all',
    auto_reassign: 'enabled',
    priority_threshold: 80,
    sticky_note: '',
  },
};

export const TASK_ROW_FIELDS: RowFieldBundle = {
  title: '任务设置',
  fields: [
    { key: 'nickname', label: '任务昵称', type: 'text', placeholder: '如：晨间补货批次A' },
    { key: 'business_tag', label: '业务标签', type: 'text', placeholder: '如：SLA-P0' },
    { key: 'operator_note', label: '处理备注', type: 'textarea', width: 'full' },
  ],
  initial: { nickname: '', business_tag: '', operator_note: '' },
};

// ---------- 2. 订单管理 ----------
export const ORDERS_PAGE_FIELDS: PageFieldBundle = {
  storageKey: 'simulation::orders::page',
  title: '订单规则设置',
  eyebrow: 'ORDER RULES',
  description: '设置单号前缀、紧急阈值与合并策略，便于与下游系统对齐。',
  fields: [
    { key: 'order_prefix', label: '单号前缀', type: 'text', placeholder: '如：WH-2026' },
    { key: 'urgent_threshold', label: '紧急阈值（分钟）', type: 'number', min: 1, max: 1440 },
    {
      key: 'auto_consolidate',
      label: '同 SKU 自动合并',
      type: 'select',
      options: [
        { value: 'enabled', label: '启用' },
        { value: 'disabled', label: '禁用' },
      ],
    },
    { key: 'consolidate_note', label: '运营备注', type: 'textarea', width: 'full' },
  ],
  initial: {
    order_prefix: 'WH',
    urgent_threshold: 30,
    auto_consolidate: 'enabled',
    consolidate_note: '',
  },
};

export const ORDER_ROW_FIELDS: RowFieldBundle = {
  title: '货物设置',
  fields: [
    { key: 'alias', label: '货物别名', type: 'text', placeholder: '如：节日礼盒' },
    { key: 'expected_at', label: '预计完成时间', type: 'text', placeholder: 'HH:mm' },
    { key: 'note', label: '处理备注', type: 'textarea', width: 'full' },
  ],
  initial: { alias: '', expected_at: '', note: '' },
};

// ---------- 3. 设备管理 ----------
export const DEVICES_PAGE_FIELDS: PageFieldBundle = {
  storageKey: 'simulation::devices::page',
  title: '车队运行偏好',
  eyebrow: 'FLEET RULES',
  description: '统一管理车队别名、低电量告警阈值与自动充电策略。',
  fields: [
    { key: 'fleet_alias', label: '车队别名', type: 'text', placeholder: '如：A 班次主力车队' },
    { key: 'low_battery_alert', label: '低电量告警（%）', type: 'number', min: 5, max: 50 },
    { key: 'auto_charge_threshold', label: '自动充电触发（%）', type: 'number', min: 5, max: 50 },
    { key: 'maintenance_note', label: '维护说明', type: 'textarea', width: 'full', placeholder: '记录设备维护窗口/责任人' },
  ],
  initial: {
    fleet_alias: '',
    low_battery_alert: 20,
    auto_charge_threshold: 15,
    maintenance_note: '',
  },
};

export const AGV_ROW_FIELDS: RowFieldBundle = {
  title: 'AGV 配置',
  fields: [
    { key: 'nickname', label: '设备昵称', type: 'text', placeholder: '如：车间东门 1 号' },
    { key: 'current_task_override', label: '当前任务备注', type: 'text', placeholder: '如：等待人工放行' },
    {
      key: 'runtime_status',
      label: '运行状态',
      type: 'select',
      options: [
        { value: 'normal', label: '正常运行' },
        { value: 'maintenance', label: '维护中' },
        { value: 'decommissioned', label: '已停用' },
      ],
    },
    { key: 'note', label: '备注', type: 'textarea', width: 'full' },
  ],
  initial: { nickname: '', current_task_override: '', runtime_status: 'normal', note: '' },
};

// ---------- 4. 智能体协同 ----------
export const AGENTS_PAGE_FIELDS: PageFieldBundle = {
  storageKey: 'simulation::agents::page',
  title: '智能体协同偏好',
  eyebrow: 'AGENT ORCHESTRATION',
  description: '控制多智能体区域的负载均衡策略与显示选项。',
  fields: [
    { key: 'agent_region', label: '责任区域', type: 'text', placeholder: '如：仓储 A 区' },
    {
      key: 'auto_balance',
      label: '负载自动均衡',
      type: 'select',
      options: [
        { value: 'enabled', label: '启用' },
        { value: 'disabled', label: '禁用' },
      ],
    },
    { key: 'dispatch_note', label: '调度说明', type: 'textarea', width: 'full' },
  ],
  initial: { agent_region: '', auto_balance: 'enabled', dispatch_note: '' },
};

export const AGENT_ROW_FIELDS: RowFieldBundle = {
  title: '智能体配置',
  fields: [
    { key: 'alias', label: '智能体别名', type: 'text', placeholder: '如：排程主脑' },
    { key: 'custom_role', label: '业务角色', type: 'text', placeholder: '如：异常兜底' },
    { key: 'note', label: '备注', type: 'text', placeholder: '备注' },
  ],
  initial: { alias: '', custom_role: '', note: '' },
};

// ---------- 5. 告警中心 ----------
export const ALERTS_PAGE_FIELDS: PageFieldBundle = {
  storageKey: 'simulation::alerts::page',
  title: '告警中心偏好',
  eyebrow: 'ALERT PREFERENCES',
  description: '设置告警过滤、静默时长与值班信息，方便快速处理。',
  fields: [
    {
      key: 'severity_filter',
      label: '严重度过滤',
      type: 'select',
      options: [
        { value: 'all', label: '全部' },
        { value: 'error', label: '仅错误' },
        { value: 'warn', label: '仅警告' },
      ],
    },
    { key: 'mute_minutes', label: '静默时长（分钟）', type: 'number', min: 0, max: 60 },
    { key: 'duty_user', label: '当前值班', type: 'text', placeholder: '如：张三' },
    { key: 'duty_note', label: '值班交接', type: 'textarea', width: 'full' },
  ],
  initial: { severity_filter: 'all', mute_minutes: 0, duty_user: '', duty_note: '' },
};

export const ALERT_ROW_FIELDS: RowFieldBundle = {
  title: '告警处理',
  fields: [
    {
      key: 'severity_override',
      label: '严重度调整',
      type: 'select',
      options: [
        { value: 'none', label: '不调整' },
        { value: 'upgrade', label: '升级一档' },
        { value: 'downgrade', label: '降级一档' },
      ],
    },
    { key: 'ack_note', label: '确认/处理备注', type: 'text', placeholder: '确认/处理备注' },
  ],
  initial: { severity_override: 'none', ack_note: '' },
};

// ---------- 6. 数据看板 ----------
export const DASHBOARD_PAGE_FIELDS: PageFieldBundle = {
  storageKey: 'simulation::dashboard::page',
  title: '看板展示偏好',
  eyebrow: 'DASHBOARD',
  description: '为数据看板指定团队标题、刷新节奏与备注，让运维/管理层有共同上下文。',
  fields: [
    { key: 'dashboard_title', label: '看板标题', type: 'text', placeholder: '如：早高峰诊断' },
    { key: 'refresh_interval_sec', label: '刷新间隔（秒）', type: 'number', min: 1, max: 60 },
    { key: 'custom_note', label: '团队备注', type: 'textarea', width: 'full' },
  ],
  initial: { dashboard_title: '运行诊断看板', refresh_interval_sec: 5, custom_note: '' },
};

// ---------- 7. 运行设置 ----------
export const SETTINGS_PAGE_FIELDS: PageFieldBundle = {
  storageKey: 'simulation::settings::page',
  title: '运行显示设置',
  eyebrow: 'RUN SETTINGS',
  description: '为本次仿真设置本地别名、说明与视觉强调色，方便与历史运行区分。',
  fields: [
    { key: 'run_label', label: '本次运行别名', type: 'text', placeholder: '如：周末压力测试' },
    { key: 'description', label: '运行说明', type: 'textarea', width: 'full' },
    {
      key: 'accent_color',
      label: '强调色',
      type: 'select',
      options: [
        { value: 'blue', label: '蓝' },
        { value: 'green', label: '绿' },
        { value: 'purple', label: '紫' },
        { value: 'orange', label: '橙' },
      ],
    },
  ],
  initial: { run_label: '', description: '', accent_color: 'blue' },
};
