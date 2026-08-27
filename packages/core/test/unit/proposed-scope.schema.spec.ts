import { ProposedScopeSchema } from '../../src/agents/langgraph/schemas/proposed-scope.response';

describe('ProposedScopeSchema (Zod Schema)', () => {
  const validScopePayload = {
    projectGoal: 'Build an AI assistant platform',
    mustHave: ['User Authentication', 'GraphQL API', 'Queue Worker'],
    shouldHave: ['Markdown Export', 'Rate Limiting'],
    couldHave: ['Dark Mode UI', 'Audio Transcription'],
    wontHave: ['Native Mobile App in v1'],
    businessConstraints: ['Max 10s latency for LLM calls', 'Budget $100/mo for OpenAI'],
  };

  it('should successfully parse and validate a valid scope payload', () => {
    const result = ProposedScopeSchema.safeParse(validScopePayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectGoal).toBe('Build an AI assistant platform');
      expect(result.data.mustHave).toHaveLength(3);
      expect(result.data.shouldHave).toHaveLength(2);
      expect(result.data.couldHave).toHaveLength(2);
      expect(result.data.wontHave).toHaveLength(1);
      expect(result.data.businessConstraints).toHaveLength(2);
    }
  });

  it('should fail validation when projectGoal is missing', () => {
    const invalidPayload = {
      ...validScopePayload,
      projectGoal: undefined,
    };

    const result = ProposedScopeSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it('should fail validation when mustHave is not an array of strings', () => {
    const invalidPayload = {
      ...validScopePayload,
      mustHave: 'not-an-array',
    };

    const result = ProposedScopeSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it('should fail validation when array items are numbers instead of strings', () => {
    const invalidPayload = {
      ...validScopePayload,
      shouldHave: [123, 456],
    };

    const result = ProposedScopeSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });
});
