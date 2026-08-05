/**
 * WebSocket 客户端 - 带重连 + 心跳 + 事件订阅
 * 用于仿真空间接收 tick、事件流
 */

export interface WsClientOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (e: Event) => void;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  heartbeatPayload?: string;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private opts: Required<Omit<WsClientOptions, 'onMessage' | 'onOpen' | 'onClose' | 'onError'>> &
    Pick<WsClientOptions, 'onMessage' | 'onOpen' | 'onClose' | 'onError'>;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private retryCount = 0;

  constructor(options: WsClientOptions) {
    this.url = options.url;
    this.opts = {
      url: options.url,
      reconnectInterval: options.reconnectInterval ?? 3000,
      heartbeatInterval: options.heartbeatInterval ?? 15000,
      heartbeatPayload: options.heartbeatPayload ?? JSON.stringify({ type: 'ping' }),
      onMessage: options.onMessage,
      onOpen: options.onOpen,
      onClose: options.onClose,
      onError: options.onError,
    };
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.closedByUser = false;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.retryCount = 0;
      this.startHeartbeat();
      this.opts.onOpen?.();
    };
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'pong') return;
        this.opts.onMessage?.(data);
      } catch {
        // Non-JSON payload: likely a protocol-level error or binary frame.
        // Forward to onError so the consumer can log / surface the anomaly
        // instead of silently dropping the message.
        this.opts.onError?.(new ErrorEvent('message', { message: `Non-JSON WebSocket message received: ${String(event.data)}` }));
        this.opts.onMessage?.(event.data);
      }
    };
    this.ws.onerror = (e) => {
      this.opts.onError?.(e);
    };
    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.opts.onClose?.();
      if (!this.closedByUser) this.scheduleReconnect();
    };
  }

  send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    }
  }

  close(): void {
    this.closedByUser = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send(this.opts.heartbeatPayload);
    }, this.opts.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
    this.retryCount += 1;
    const delay = Math.min(this.opts.reconnectInterval * Math.min(this.retryCount, 5), 30000);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
