import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  MessageEvent,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SseEventMessage, SseEventType } from '@context-whisperer/core';
import IORedis from 'ioredis';
import { Observable, Subject, merge, interval } from 'rxjs';
import { map, finalize, filter } from 'rxjs/operators';

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private redisSubscriber!: IORedis;
  private redisPublisher!: IORedis;
  private eventSubject = new Subject<{
    channel: string;
    message: SseEventMessage;
  }>();
  private activeSubscriptions = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.redisSubscriber = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.redisPublisher = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.redisSubscriber.on(
      'message',
      (channel: string, rawMessage: string) => {
        try {
          const parsed = JSON.parse(rawMessage) as SseEventMessage;
          this.eventSubject.next({ channel, message: parsed });
        } catch (err) {
          this.logger.error(
            `Failed to parse message from channel ${channel}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      },
    );
  }

  async onModuleDestroy() {
    await this.redisSubscriber.quit();
    await this.redisPublisher.quit();
  }

  /**
   * Publica um evento no canal Redis do usuário
   */
  async publishUserEvent(
    userId: string,
    event: SseEventMessage,
  ): Promise<void> {
    const channel = `USER_EVENTS_${userId}`;
    await this.redisPublisher.publish(channel, JSON.stringify(event));
  }

  /**
   * Retorna um Observable de SSE para o usuário conectado
   */
  getUserEventStream(userId: string): Observable<MessageEvent> {
    const channel = `USER_EVENTS_${userId}`;

    // Incrementa contagem de ouvintes e assina no Redis se for o primeiro
    const currentCount = this.activeSubscriptions.get(channel) || 0;
    this.activeSubscriptions.set(channel, currentCount + 1);

    if (currentCount === 0) {
      void this.redisSubscriber.subscribe(channel);
    }

    // 1. Stream de eventos reais vindos do Redis
    const redisEvents$ = this.eventSubject.asObservable().pipe(
      filter((item) => item.channel === channel),
      map((item) => ({
        data: item.message,
        type: item.message.type,
      })),
    );

    // 2. Stream de Heartbeat a cada 25 segundos para manter a conexão ativa
    const heartbeat$ = interval(25000).pipe(
      map(
        (): MessageEvent => ({
          type: SseEventType.HEARTBEAT,
          data: {
            type: SseEventType.HEARTBEAT,
            userId,
            timestamp: new Date().toISOString(),
            data: { ping: true },
          },
        }),
      ),
    );

    return merge(redisEvents$, heartbeat$).pipe(
      finalize(() => {
        // Decrementa ouvintes ao desconectar
        const count = this.activeSubscriptions.get(channel) || 1;
        if (count <= 1) {
          this.activeSubscriptions.delete(channel);
          void this.redisSubscriber.unsubscribe(channel);
        } else {
          this.activeSubscriptions.set(channel, count - 1);
        }
      }),
    );
  }
}
