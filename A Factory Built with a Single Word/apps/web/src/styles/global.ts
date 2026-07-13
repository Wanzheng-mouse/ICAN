import { createGlobalStyle } from 'antd-style';

/**
 * 全局样式 - 贴近原型的深蓝科技感
 * 主色: #2b6fff (主题蓝)
 * 背景: #f5f7fb (内容区) / #0b1733 (顶部导航) / #ffffff (卡片)
 */
export const GlobalStyle = createGlobalStyle`
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
      'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
    background: #f4f7fc;
    color: #17213a;
    letter-spacing: 0.01em;
  }

  html[data-theme='dark'] body,
  html[data-theme='dark'] #root {
    background: #0c1428;
    color: #e5edf9;
  }
  html[data-theme='dark'] .section-card,
  html[data-theme='dark'] .notif-card {
    background: #111a2f;
    border-color: #2b3b5c;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
  }
  html[data-theme='dark'] .section-title,
  html[data-theme='dark'] .search-title,
  html[data-theme='dark'] .notif-title { color: #e5edf9; }
  html[data-theme='dark'] .search-result-item { border-color: #22314d; }
  html[data-theme='dark'] .search-result-item:hover,
  html[data-theme='dark'] .notif-row:hover { background: #17233d; }

  * {
    box-sizing: border-box;
  }

  /* 滚动条 */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #d4dbe5;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #b0bac8;
  }

  /* AntD 卡片轻量化 */
  .ant-card {
    border-radius: 16px !important;
    border: 1px solid rgba(220, 228, 240, 0.88) !important;
    box-shadow: 0 10px 30px rgba(30, 52, 93, 0.055) !important;
    overflow: hidden;
  }
  .ant-card-head {
    border-bottom: 1px solid #edf1f7 !important;
    min-height: 48px !important;
    padding: 0 20px !important;
  }
  .ant-card-head-title {
    font-weight: 600 !important;
    font-size: 15px !important;
  }
  .ant-card-extra {
    color: #6b7280;
  }

  /* 通用工具类 */
  .flex { display: flex; }
  .flex-center { display: flex; align-items: center; justify-content: center; }
  .flex-between { display: flex; align-items: center; justify-content: space-between; }
  .flex-col { display: flex; flex-direction: column; }
  .gap-8 { gap: 8px; }
  .gap-12 { gap: 12px; }
  .gap-16 { gap: 16px; }
  .gap-24 { gap: 24px; }

  /* 数字字体 */
  .num-font {
    font-family: 'DIN Alternate', 'SF Mono', Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }

  /* 状态点 */
  .status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
  }
  .status-dot.success { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18); }
  .status-dot.warning { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18); }
  .status-dot.error { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18); }
  .status-dot.info { background: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18); }
  .status-dot.running {
    background: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
    animation: pulse 1.6s infinite;
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45); }
    70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
    100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  }

  /* 页面通用 padding */
  .page-container {
    padding: 28px 32px 36px;
    min-height: calc(100vh - 60px);
  }
  .page-container-wide {
    padding: 28px 36px 36px;
    min-height: calc(100vh - 60px);
  }
  .page-container-narrow {
    padding: 28px 32px 36px;
    max-width: 1600px;
    margin: 0 auto;
  }

  /* 章节卡片 */
  .section-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid rgba(220, 228, 240, 0.9);
    padding: 22px 24px;
    margin-bottom: 18px;
    box-shadow: 0 10px 30px rgba(30, 52, 93, 0.045);
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: #17213a;
    margin: 0 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-title .icon {
    display: inline-flex;
    width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    color: #2b6fff;
  }
`;
