import { message, Select, Space, Switch, Typography } from 'antd';
import { useAppStore } from '@/stores/useAppStore';
import { SectionCard } from '@/components';
import './Account.css';

const { Text } = Typography;

export default function PreferencesPage() {
  const user = useAppStore((s) => s.user);
  const updatePrefs = useAppStore((s) => s.updatePreferences);
  const prefs = user?.preferences;

  const set = (key: keyof NonNullable<typeof prefs>, value: boolean | string) => {
    updatePrefs({ [key]: value });
    if (key.startsWith('notify')) {
      message.success(`通知${value ? '已开启' : '已关闭'}`);
    } else if (key === 'defaultPage') {
      message.success(`默认首页已设置为 ${value === '/' ? '首页' : value === '/simulation' ? '仿真空间' : '运行报告'}`);
    } else if (key === 'demoMode') {
      message.success(`演示模式${value ? '已开启（始终使用 Mock 数据）' : '已关闭（将请求真实后端）'}`);
    } else if (key === 'theme') {
      message.success(value ? '已切换为深色主题' : '已切换为浅色主题');
    }
  };

  if (!prefs) return null;

  return (
    <div className="account-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <SectionCard title="界面偏好">
          <div className="pref-list">
            <div className="pref-row">
              <div>
                <Text strong>默认首页</Text>
                <div className="pref-desc">登录后默认跳转的页面</div>
              </div>
              <Select value={prefs.defaultPage} onChange={(v) => set('defaultPage', v)} style={{ width: 200 }}
                options={[
                  { value: '/', label: '首页' },
                  { value: '/simulation', label: '仿真空间' },
                  { value: '/report', label: '运行报告' },
                ]}
              />
            </div>
            <div className="pref-row">
              <div>
                <Text strong>演示模式</Text>
                <div className="pref-desc">保存本机演示偏好；实际数据源由部署环境统一配置</div>
              </div>
              <Switch checked={prefs.demoMode} onChange={(v) => set('demoMode', v)} />
            </div>
            <div className="pref-row">
              <div>
                <Text strong>深色主题</Text>
                <div className="pref-desc">立即切换全站界面配色</div>
              </div>
              <Switch checked={prefs.theme === 'dark'} onChange={(v) => set('theme', v ? 'dark' : 'light')} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="通知偏好">
          <div className="pref-list">
            <div className="pref-row">
              <div>
                <Text strong>仿真告警</Text>
                <div className="pref-desc">异常注入、AGV 告警、拥堵通知</div>
              </div>
              <Switch checked={prefs.notifyAlert} onChange={(v) => set('notifyAlert', v)} />
            </div>
            <div className="pref-row">
              <div>
                <Text strong>任务完成</Text>
                <div className="pref-desc">项目创建完成、仿真运行结束</div>
              </div>
              <Switch checked={prefs.notifyTask} onChange={(v) => set('notifyTask', v)} />
            </div>
            <div className="pref-row">
              <div>
                <Text strong>系统公告</Text>
                <div className="pref-desc">平台更新、维护通知、版本发布</div>
              </div>
              <Switch checked={prefs.notifySystem} onChange={(v) => set('notifySystem', v)} />
            </div>
          </div>
        </SectionCard>
      </Space>
    </div>
  );
}
