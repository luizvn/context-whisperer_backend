import { buildGraph } from '../../../src/workflows/agents/graph';

const mockConnect = jest.fn();

jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: (...args: unknown[]) => Promise.resolve(mockConnect(...args)),
  })),
}));

jest.mock('@langchain/langgraph-checkpoint-mongodb', () => ({
  MongoDBSaver: jest.fn().mockImplementation(() => ({})),
}));

describe('buildGraph (StateGraph compilation with MongoDB Checkpointer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to MongoDB and compile the StateGraph with MongoDBSaver checkpointer', async () => {
    const graph = await buildGraph();

    expect(mockConnect).toHaveBeenCalled();
    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe('function');
  });
});
