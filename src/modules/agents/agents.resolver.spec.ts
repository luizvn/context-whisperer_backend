import { AgentsResolver } from './agents.resolver';
import { AgentsService } from './agents.service';

jest.mock('./agents.service', () => ({ AgentsService: jest.fn() }));
jest.mock('../auth/guards/gql-auth.guard', () => ({ GqlAuthGuard: jest.fn() }));
jest.mock('../auth/decorators/current-user.decorator', () => ({
  CurrentUser: () => () => undefined,
}));
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'thread-1'),
}));

describe('AgentsResolver', () => {
  let resolver: AgentsResolver;
  let agentsService: jest.Mocked<Pick<AgentsService, 'executeWorkflow'>>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    agentsService = {
      executeWorkflow: jest.fn().mockResolvedValue(undefined),
    };
    resolver = new AgentsResolver(agentsService as AgentsService);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts the project workflow and returns the generated thread id', () => {
    const pubsub = { publish: jest.fn(), subscribe: jest.fn() };
    const input = { prompt: 'Build a project planner' };
    const user = { id: 'user-1' };

    expect(resolver.createProject(input, user as never, { pubsub })).toBe(
      'thread-1',
    );
    expect(agentsService.executeWorkflow).toHaveBeenCalledWith(
      input,
      'thread-1',
      user,
      pubsub,
    );
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('uses the reply pubsub fallback when context.pubsub is missing', () => {
    const replyPubsub = { publish: jest.fn(), subscribe: jest.fn() };

    resolver.createProject(
      { prompt: 'Build a project planner' },
      { id: 'user-1' } as never,
      { reply: { pubsub: replyPubsub } } as never,
    );

    expect(agentsService.executeWorkflow).toHaveBeenCalledWith(
      { prompt: 'Build a project planner' },
      'thread-1',
      { id: 'user-1' },
      replyPubsub,
    );
  });

  it('logs workflow errors without throwing from createProject', async () => {
    agentsService.executeWorkflow.mockRejectedValue(
      new Error('workflow failed'),
    );

    expect(
      resolver.createProject(
        { prompt: 'Build a project planner' },
        { id: 'user-1' } as never,
        { pubsub: { publish: jest.fn(), subscribe: jest.fn() } },
      ),
    ).toBe('thread-1');

    await Promise.resolve();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[AgentsResolver] Error in workflow for thread:',
      'workflow failed',
    );
  });

  it('subscribes to user events with the available pubsub', async () => {
    const iterator = {} as AsyncIterableIterator<unknown>;
    const pubsub = {
      publish: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(iterator),
    };

    await expect(resolver.agentEvents('user-1', { pubsub })).resolves.toBe(
      iterator,
    );
    expect(pubsub.subscribe).toHaveBeenCalledWith('USER_EVENTS_user-1');
  });
});
