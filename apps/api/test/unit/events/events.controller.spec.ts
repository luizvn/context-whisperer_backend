import { EventsController } from '../../../src/modules/events/events.controller';
import { EventsService } from '../../../src/modules/events/events.service';
import { of } from 'rxjs';
import { User } from '@context-whisperer/database';
import { FastifyRequest } from 'fastify';

describe('EventsController (SSE Endpoint)', () => {
  let controller: EventsController;
  const mockGetUserEventStream = jest.fn();

  const mockUser: User = {
    id: 'user-controller-123',
    name: 'Neo',
    email: 'neo@matrix.org',
    password: 'hash',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserEventStream.mockReturnValue(of({ data: { hello: 'world' } }));

    const eventsService = {
      getUserEventStream: mockGetUserEventStream,
    } as unknown as EventsService;

    controller = new EventsController(eventsService);
  });

  it('should call eventsService.getUserEventStream with authenticated user ID', () => {
    const mockRequest = {
      user: mockUser,
    } as unknown as FastifyRequest & { user: User };

    const result$ = controller.streamEvents(mockRequest);

    expect(mockGetUserEventStream).toHaveBeenCalledWith(mockUser.id);
    expect(result$).toBeDefined();
  });
});
