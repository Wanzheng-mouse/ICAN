import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { MainLayout } from '@/layouts/MainLayout';
import { ConsoleLayout } from '@/layouts/ConsoleLayout';
import { RequireAuth } from '@/components/RequireAuth';

const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Login/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const Home = lazy(() => import('@/pages/Home'));
const Simulation = lazy(() => import('@/pages/Simulation'));
const Evolution = lazy(() => import('@/pages/Evolution'));
const Report = lazy(() => import('@/pages/Report'));
const Resource = lazy(() => import('@/pages/Resource'));
const Orchestration = lazy(() => import('@/pages/Orchestration'));
const Editor = lazy(() => import('@/pages/Editor'));
const Help = lazy(() => import('@/pages/Help'));
const SearchPage = lazy(() => import('@/pages/Search'));
const NotificationsPage = lazy(() => import('@/pages/Notifications'));
const ProfilePage = lazy(() => import('@/pages/Account/Profile'));
const SettingsPage = lazy(() => import('@/pages/Account/Settings'));
const PreferencesPage = lazy(() => import('@/pages/Account/Preferences'));
const AccountLayout = lazy(() => import('@/pages/Account/AccountLayout'));

function PageLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
      <Spin size="large" />
      <span style={{ color: '#6b7280', fontSize: 13 }}>加载中...</span>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* 首页（需登录） */}
        <Route path="/" element={<RequireAuth><MainLayout><Home /></MainLayout></RequireAuth>} />
        <Route path="/help" element={<RequireAuth><MainLayout><Help /></MainLayout></RequireAuth>} />

        {/* 搜索 & 通知 */}
        <Route path="/search" element={<RequireAuth><MainLayout><SearchPage /></MainLayout></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><MainLayout variant="wide"><NotificationsPage /></MainLayout></RequireAuth>} />

        {/* 账号中心 */}
        <Route path="/account" element={<RequireAuth><MainLayout variant="wide"><AccountLayout /></MainLayout></RequireAuth>}>
          <Route index element={<ProfilePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
        </Route>

        {/* 仿真空间 */}
        <Route element={<RequireAuth><ConsoleLayout /></RequireAuth>}>
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/simulation/tasks" element={<Simulation />} />
          <Route path="/simulation/devices" element={<Simulation />} />
          <Route path="/simulation/orders" element={<Simulation />} />
          <Route path="/simulation/agents" element={<Simulation />} />
          <Route path="/simulation/alerts" element={<Simulation />} />
          <Route path="/simulation/dashboard" element={<Simulation />} />
          <Route path="/simulation/settings" element={<Simulation />} />
        </Route>

        {/* 其他业务页 */}
        <Route path="/evolution" element={<RequireAuth><MainLayout variant="wide"><Evolution /></MainLayout></RequireAuth>} />
        <Route path="/report" element={<RequireAuth><MainLayout variant="wide"><Report /></MainLayout></RequireAuth>} />
        <Route path="/resource" element={<RequireAuth><MainLayout variant="wide"><Resource /></MainLayout></RequireAuth>} />
        <Route path="/orchestration" element={<RequireAuth><MainLayout variant="wide"><Orchestration /></MainLayout></RequireAuth>} />
        <Route path="/editor" element={<RequireAuth><MainLayout variant="wide"><Editor /></MainLayout></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
