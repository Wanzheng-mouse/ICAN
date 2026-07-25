import { useCallback, useEffect, useRef, useState } from 'react';
import { isMockEnabled } from '@/api/mockConfig';
import { WsClient } from '@/api/ws';
import type { SimulationTickRead } from '@/api/dtos/backend';
import { useAppStore } from '@/stores/useAppStore';
import { apiPrefix } from '@/utils/apiUrl';

export type SimulationConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface SimulationStreamState {
  connectionState: SimulationConnectionState;
  tick: SimulationTickRead | null;
  lastReceivedAt: string | null;
  reconnectCount: number;
  error: string | null;
  reconnect: () => void;
}

export function isSimulationTick(payload: unknown): payload is SimulationTickRead {
  const value = payload as Partial<SimulationTickRead> | null;
  return Boolean(
    value &&
    value.type === 'simulation_tick' &&
    typeof value.run_id === 'string' &&
    typeof value.time === 'number' &&
    Array.isArray(value.robots) &&
    value.tasks &&
    value.metrics,
  );
}

export function resolveSimulationWsUrl(simulationId: string, token?: string | null): string {
  const configured = String(import.meta.env.VITE_WS_URL || '').replace(/\/$/, '');
  const suffix = token ? `?token=${encodeURIComponent(token)}` : '';
  if (configured) return `${configured}${apiPrefix}/simulations/${simulationId}/stream${suffix}`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${apiPrefix}/simulations/${simulationId}/stream${suffix}`;
}

function mockTick(simulationId: string, elapsed: number): SimulationTickRead {
  const robotCount = 10;
  const total = 20;
  const completion = Math.min(1, elapsed * robotCount / (total * 10));
  return {
    type: 'simulation_tick',
    run_id: simulationId,
    time: elapsed,
    robots: Array.from({ length: robotCount }, (_, index) => ({
      id: `agv-${String(index + 1).padStart(2, '0')}`,
      state: elapsed ? 'working' : 'idle',
      battery: Math.max(20, 100 - elapsed),
    })),
    tasks: { total, completed: Math.round(total * completion) },
    events: [],
    metrics: {
      completion_rate: completion,
      average_duration: 120 - completion * 20,
      congestion_count: 0,
      energy: elapsed * robotCount * 0.12,
    },
    generated_at: new Date().toISOString(),
  };
}

export function useSimulationStream(
  simulationId?: string | null,
  enabled = true,
  onRecovered?: () => void,
): SimulationStreamState {
  const token = useAppStore((state) => state.token);
  const [generation, setGeneration] = useState(0);
  const [connectionState, setConnectionState] = useState<SimulationConnectionState>('idle');
  const [tick, setTick] = useState<SimulationTickRead | null>(null);
  const [lastReceivedAt, setLastReceivedAt] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recoveredRef = useRef(onRecovered);

  useEffect(() => {
    recoveredRef.current = onRecovered;
  }, [onRecovered]);

  const reconnect = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    setTick(null);
    setLastReceivedAt(null);
    setReconnectCount(0);
    setError(null);
  }, [simulationId]);

  useEffect(() => {
    if (!simulationId || !enabled) {
      setConnectionState('idle');
      return;
    }

    if (isMockEnabled('simulation')) {
      let elapsed = 0;
      setConnectionState('connected');
      const publish = () => {
        const next = mockTick(simulationId, elapsed++);
        setTick(next);
        setLastReceivedAt(next.generated_at);
      };
      publish();
      const timer = window.setInterval(publish, 1000);
      return () => window.clearInterval(timer);
    }

    let disposed = false;
    let openedBefore = false;
    setConnectionState('connecting');
    setError(null);
    const client = new WsClient({
      url: resolveSimulationWsUrl(simulationId, token),
      reconnectInterval: 1500,
      heartbeatInterval: 30000,
      onOpen: () => {
        if (disposed) return;
        setConnectionState('connected');
        setError(null);
        recoveredRef.current?.();
        if (openedBefore) {
          setReconnectCount((value) => value + 1);
        }
        openedBefore = true;
      },
      onClose: () => {
        if (!disposed) setConnectionState(openedBefore ? 'reconnecting' : 'connecting');
      },
      onError: () => {
        if (disposed) return;
        setConnectionState('error');
        setError('实时连接异常，系统正在自动重连');
      },
      onMessage: (payload) => {
        if (disposed) return;
        if (isSimulationTick(payload)) {
          setTick(payload);
          setLastReceivedAt(payload.generated_at || new Date().toISOString());
        } else if ((payload as { type?: string })?.type === 'simulation_completed') {
          recoveredRef.current?.();
        } else if ((payload as { type?: string })?.type === 'error') {
          setError(String((payload as { message?: string }).message || '仿真实时流返回错误'));
        }
      },
    });
    client.connect();
    return () => {
      disposed = true;
      client.close();
    };
  }, [enabled, generation, simulationId, token]);

  return { connectionState, tick, lastReceivedAt, reconnectCount, error, reconnect };
}
