import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8000';
  const wsUrl = env.VITE_WS_URL || 'ws://localhost:8000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@ican/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
        '@ican/mock-data': path.resolve(__dirname, '../../packages/mock-data/src'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      open: false,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/ws': {
          target: wsUrl,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            antd: ['antd', '@ant-design/icons'],
            echarts: ['echarts', 'echarts-for-react'],
            konva: ['konva', 'react-konva'],
            flow: ['@xyflow/react'],
          },
        },
      },
    },
  };
});
