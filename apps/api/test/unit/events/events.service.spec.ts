import { EventsService } from '../../../src/modules/events/events.service';
import { ConfigService } from '@nestjs/config';
import { SseEventType, SseEventMessage } from '@context-whisperer/core';
import { take } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();
const mockPublish = jest.fn();
const mockQuit = jest.fn();

let messageHandler: ((channel: string, message: string) => void) | undefined;

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(
      (event: string, handler: (channel: string, message: string) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      },
    ),
    subscribe: (...args: unknown[]) => Promise.resolve(mockSubscribe(...args)),
    unsubscribe: (...args: unknown[]) =>
      Promise.resolve(mockUnsubscribe(...args)),
    publish: (...args: unknown[]) => Promise.resolve(mockPublish(...args)),
    quit: (...args: unknown[]) => Promise.resolve(mockQuit(...args)),
  }));
});

describe('EventsService (SSE & Redis PubSub)', () => {
  let service: EventsService;
  let configService: ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    } as unknown as ConfigService;

    service = new EventsService(configService);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should publish user events to Redis on the USER_EVENTS channel', async () => {
    const event: SseEventMessage = {
      type: SseEventType.SCOPE_READY,
      userId: 'user-123',
      requisitionId: 'req-456',
      timestamp: new Date().toISOString(),
      data: { id: 'prop-1' },
    };

    await service.publishUserEvent('user-123', event);

    expect(mockPublish).toHaveBeenCalledWith(
      'USER_EVENTS_user-123',
      JSON.stringify(event),
    );
  });

  it('should stream events received from Redis PubSub to connected user observable', async () => {
    const userId = 'user-test-777';
    const stream$ = service.getUserEventStream(userId);

    const eventPromise = firstValueFrom(stream$.pipe(take(1)));

    expect(mockSubscribe).toHaveBeenCalledWith(`USER_EVENTS_${userId}`);

    // Simula mensagem chegando no Redis Subscriber
    const sseMessage: SseEventMessage = {
      type: SseEventType.SCOPE_READY,
      userId,
      requisitionId: 'req-999',
      timestamp: new Date().toISOString(),
      data: { ready: true },
    };

    if (messageHandler) {
      messageHandler(`USER_EVENTS_${userId}`, JSON.stringify(sseMessage));
    }

    const received = await eventPromise;
    expect(received.type).toBe(SseEventType.SCOPE_READY);
    expect(received.data).toEqual(sseMessage);
  });
});
