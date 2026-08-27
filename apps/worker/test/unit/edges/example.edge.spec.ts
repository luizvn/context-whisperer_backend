import { shouldContinueEdge } from '../../../src/workflows/agents/edges/example.edge';
import { GraphStateType, ArtifactType } from '@context-whisperer/core';
import { HumanMessage } from '@langchain/core/messages';

describe('example.edge (Conditional Routing)', () => {
  const baseState: GraphStateType = {
    projectRequest: {
      name: 'Test Project',
      prompt: 'Build a mobile app',
      artifacts: [ArtifactType.REQUIREMENTS],
    },
    requisitionId: 'req-123',
    userId: 'user-123',
    scopeProposalId: 'prop-123',
    messages: [],
  };

  it('should return "exampleNode" when messages count is <= 3', () => {
    const state: GraphStateType = {
      ...baseState,
      messages: [
        new HumanMessage('Message 1'),
        new HumanMessage('Message 2'),
      ],
    };

    const nextNode = shouldContinueEdge(state);
    expect(nextNode).toBe('exampleNode');
  });

  it('should return "__end__" when messages count is > 3', () => {
    const state: GraphStateType = {
      ...baseState,
      messages: [
        new HumanMessage('Message 1'),
        new HumanMessage('Message 2'),
        new HumanMessage('Message 3'),
        new HumanMessage('Message 4'),
      ],
    };

    const nextNode = shouldContinueEdge(state);
    expect(nextNode).toBe('__end__');
  });
});
