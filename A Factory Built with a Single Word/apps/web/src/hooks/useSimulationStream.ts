import { useCallback, useEffect, useRef, useState } from 'react';
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
