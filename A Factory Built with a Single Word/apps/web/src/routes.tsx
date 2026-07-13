import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { MainLayout } from '@/layouts/MainLayout';
import { ConsoleLayout } from '@/layouts/ConsoleLayout';

const Home = lazy(() => import('@/pages/Home'));
const Simulation = lazy(() => import('@/pages/Simulation'));
const Evolution = lazy(() => import('@/pages/Evolution'));
const Report = lazy(() => import('@/pages/Report'));
const Resource = lazy(() => import('@/pages/Resource'));
const Orchestration = lazy(() => import('@/pages/Orchestration'));
const Editor = lazy(() => import('@/pages/Editor'));
const Help = lazy(() => import('@/pages/Help'));

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
        <Route
          path="/"
          element={
            <MainLayout>
              <Home />
            </MainLayout>
          }
        />
        <Route element={<ConsoleLayout />}>
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/simulation/tasks" element={<Simulation />} />
          <Route path="/simulation/devices" element={<Simulation />} />
          <Route path="/simulation/orders" element={<Simulation />} />
          <Route path="/simulation/agents" element={<Simulation />} />
          <Route path="/simulation/alerts" element={<Simulation />} />
          <Route path="/simulation/dashboard" element={<Simulation />} />
          <Route path="/simulation/settings" element={<Simulation />} />
        </Route>
        <Route
          path="/evolution"
          element={
            <MainLayout variant="wide">
              <Evolution />
            </MainLayout>
          }
        />
        <Route
          path="/report"
          element={
            <MainLayout variant="wide">
              <Report />
            </MainLayout>
          }
        />
        <Route
          path="/resource"
          element={
            <MainLayout variant="wide">
              <Resource />
            </MainLayout>
          }
        />
        <Route
          path="/orchestration"
          element={
            <MainLayout variant="wide">
              <Orchestration />
            </MainLayout>
          }
        />
        <Route
          path="/editor"
          element={
            <MainLayout variant="wide">
              <Editor />
            </MainLayout>
          }
        />
        <Route
          path="/help"
          element={
            <MainLayout>
              <Help />
            </MainLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
