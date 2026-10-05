import { Injectable, inject, signal } from "@angular/core";
import { SseEventType, type SseEventMessage } from "@core/models/types";
import { AuthService } from "./auth.service";

type EventCallback<T = unknown> = (message: SseEventMessage<T>) => void;

@Injectable({
  providedIn: "root",
})
export class SseService {
  private readonly authService = inject(AuthService);

  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;
  private isConnecting = false;
  private readonly listeners = new Map<SseEventType | "ALL", Set<EventCallback>>();

  private readonly _connected = signal<boolean>(false);
  private readonly _lastEvent = signal<SseEventMessage | null>(null);

  readonly connected = this._connected.asReadonly();
  readonly lastEvent = this._lastEvent.asReadonly();

  /**
   * Conecta ao stream SSE via fetch com header Authorization: Bearer <token>
   * dispensando envio de credenciais por query params na URL.
   */
  async connect(): Promise<void> {
    if (this._connected() || this.isConnecting) {
      return;
    }

    const token = this.authService.token();
    if (!token) {
      console.warn("[SSE] Nenhum usuário autenticado para conectar ao SSE.");
      return;
    }

    this.isManualDisconnect = false;
    this.isConnecting = true;
    this.abortController = new AbortController();

    try {
      const response = await fetch("/api/events/stream", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`[SSE] Falha na conexão HTTP: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("[SSE] Resposta da API não possui ReadableStream.");
      }

      this._connected.set(true);
      this.isConnecting = false;

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (!this.isManualDisconnect) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        // O último elemento pode ser um frame incompleto, mantido no buffer
        buffer = parts.pop() ?? "";

        for (const block of parts) {
          if (!block.trim()) continue;
          this.parseAndDispatchBlock(block);
        }
      }
    } catch (err: any) {
      if (this.isManualDisconnect || err?.name === "AbortError") {
        // Desconexão manual esperada
        return;
      }
      console.warn("[SSE] Erro no stream SSE:", err);
    } finally {
      this.isConnecting = false;
      this._connected.set(false);

      if (!this.isManualDisconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Processa um bloco bruto de SSE no formato:
   * event: EVENT_TYPE
   * id: 123
   * data: {"type": "...", ...}
   */
  private parseAndDispatchBlock(block: string): void {
    const lines = block.split(/\r?\n/);
    let eventName = "";
    let dataBuffer = "";
    let id = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const chunk = line.slice(5).trim();
        dataBuffer = dataBuffer ? dataBuffer + "\n" + chunk : chunk;
      } else if (line.startsWith("id:")) {
        id = line.slice(3).trim();
      }
    }

    if (!dataBuffer) return;

    try {
      const parsed: SseEventMessage = JSON.parse(dataBuffer);
      if (eventName && !parsed.type) {
        parsed.type = eventName as SseEventType;
      }
      if (id && !parsed.id) {
        parsed.id = id;
      }
      this._lastEvent.set(parsed);
      this.dispatch(parsed);
    } catch (err) {
      console.warn("[SSE] Falha ao processar mensagem JSON:", err, dataBuffer);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 5000);
  }

  /**
   * Desconecta o stream e aborta requisições em andamento
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this._connected.set(false);
    this.isConnecting = false;
  }

  /**
   * Registra um callback para um tipo de evento específico ou para todos ('ALL')
   * Retorna uma função de desinscrição limpa.
   */
  on<T = unknown>(eventType: SseEventType | "ALL", callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const set = this.listeners.get(eventType)!;
    set.add(callback as EventCallback);

    return () => {
      set.delete(callback as EventCallback);
    };
  }

  private dispatch(message: SseEventMessage): void {
    // 1. Notifica ouvintes do tipo específico
    const specificListeners = this.listeners.get(message.type);
    if (specificListeners) {
      for (const listener of specificListeners) {
        try {
          listener(message);
        } catch (err) {
          console.error(`[SSE] Erro no listener de ${message.type}:`, err);
        }
      }
    }

    // 2. Notifica ouvintes globais 'ALL'
    const globalListeners = this.listeners.get("ALL");
    if (globalListeners) {
      for (const listener of globalListeners) {
        try {
          listener(message);
        } catch (err) {
          console.error("[SSE] Erro no listener global:", err);
        }
      }
    }
  }
}
