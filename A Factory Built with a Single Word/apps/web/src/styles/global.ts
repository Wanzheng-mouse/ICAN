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
    background: #f5f7fb;
    color: #1f2937;
  }

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
    border-radius: 10px !important;
    border: 1px solid #eef0f4 !important;
    box-shadow: 0 1px 2px rgba(11, 23, 51, 0.04) !important;
  }
  .ant-card-head {
    border-bottom: 1px solid #eef0f4 !important;
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
    padding: 20px 24px;
    min-height: calc(100vh - 60px);
  }
  .page-container-wide {
    padding: 20px 32px;
    min-height: calc(100vh - 60px);
  }
  .page-container-narrow {
    padding: 20px 24px;
    max-width: 1600px;
    margin: 0 auto;
  }

  /* 章节卡片 */
  .section-card {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #eef0f4;
    padding: 20px 24px;
    margin-bottom: 16px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
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
