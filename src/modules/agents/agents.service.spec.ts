import { AgentsService } from './agents.service';
import { buildGraph } from './langgraph/graph';
import type { OpenAIService } from '../../openai/openai.service';
import { RequisitionsService } from '../requisitions/requisitions.service';
import { ScopeProposalService } from '../scope-proposals/scope-proposal.service';

jest.mock('../../openai/openai.service', () => ({ OpenAIService: jest.fn() }));
jest.mock('./langgraph/graph', () => ({
  buildGraph: jest.fn(),
}));

describe('AgentsService', () => {
  let service: AgentsService;
  let graph: {
    invoke: jest.Mock;
  };
  let openAIService: OpenAIService;
  let scopeProposalService: ScopeProposalService;
  let requisitionService: jest.Mocked<Pick<RequisitionsService, 'create'>>;

  beforeEach(() => {
    graph = {
      invoke: jest.fn(),
    };
    jest.mocked(buildGraph).mockResolvedValue(graph as never);

    openAIService = {} as OpenAIService;
    scopeProposalService = {} as ScopeProposalService;
    requisitionService = {
      create: jest.fn(),
    };

    service = new AgentsService(
      openAIService,
      scopeProposalService,
      requisitionService as RequisitionsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds the graph when the module initializes', async () => {
    await service.onModuleInit();

    expect(buildGraph).toHaveBeenCalledTimes(1);
  });

  it('creates a requisition and invokes the workflow graph', async () => {
    const pubSub = { publish: jest.fn() };
    const result = { scopeGenerated: { id: 'proposal-1' } };
    requisitionService.create.mockResolvedValue({ id: 'req-1' } as never);
    graph.invoke.mockResolvedValue(result);

    await service.onModuleInit();

    await expect(
      service.executeWorkflow(
        { prompt: 'Build a project planner' },
        'thread-1',
        { id: 'user-1' } as never,
        pubSub,
      ),
    ).resolves.toBe(result);

    expect(requisitionService.create).toHaveBeenCalledWith(
      'user-1',
      'Build a project planner',
    );
    expect(graph.invoke).toHaveBeenCalledWith(
      {
        projectRequest: { prompt: 'Build a project planner' },
        messages: [],
        requisitionId: 'req-1',
        userId: 'user-1',
      },
      {
        configurable: {
          thread_id: 'thread-1',
          openAIService,
          scopeProposalService,
          pubSub,
        },
      },
    );
  });
});
