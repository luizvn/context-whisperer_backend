import { processGenerationJob, GenerationJobData } from '../../src/processors/generation.processor';
import { scopeAgent } from '../../src/workflows/agents/nodes/scope-agent.node';
import { ArtifactType, ProposedScopeResponse } from '@context-whisperer/core';
import { RunnableConfig } from '@langchain/core/runnables';
import type IORedis from 'ioredis';

// 1. Mock OpenAI
const mockInvoke = jest.fn();
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({
      invoke: (...args: unknown[]) => Promise.resolve(mockInvoke(...args)),
    }),
  })),
}));

// 2. In-memory database state
interface MockRequisition {
  id: string;
  userId: string;
  originalPrompt: string;
  status: string;
}

interface MockProposal {
  id: string;
  requisitionId: string;
  templateId: string;
  contentMd: string;
  status: string;
}

const inMemoryRequisitions = new Map<string, MockRequisition>();
const inMemoryProposals = new Map<string, MockProposal>();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    requisition: {
      update: jest.fn(({ where, data }: { where: { id: string }; data: { status: string } }) => {
        const req = inMemoryRequisitions.get(where.id);
        if (!req) throw new Error(`Requisition ${where.id} not found`);
        req.status = data.status;
        return Promise.resolve(req);
      }),
    },
    template: {
      findUnique: jest.fn(({ where }: { where: { name: string } }) => {
        if (where.name === 'default_scope_response') {
          return Promise.resolve({
            id: 'tmpl-response-001',
            name: where.name,
            content:
              '# Proposta de Escopo\n\n## 🎯 Objetivo do Projeto\n{{projectGoal}}\n\n## ✅ Must Have (Indispensável)\n{{mustHave}}\n\n## 🚀 Should Have (Importante)\n{{shouldHave}}\n\n## ✨ Could Have (Desejável)\n{{couldHave}}\n\n## 🚫 Won\'t Have (Fora de Escopo)\n{{wontHave}}\n\n{{businessConstraints}}',
          });
        }
        return Promise.resolve({
          id: 'tmpl-default-001',
          name: where.name,
          content: 'Você é um Engenheiro de Requisitos Sênior rigoroso.',
        });
      }),
    },
    scopeProposal: {
      create: jest.fn(({ data }: { data: { requisitionId: string; templateId: string; contentMd: string; status: string } }) => {
        const id = `prop-${Date.now()}`;
        const proposal: MockProposal = {
          id,
          requisitionId: data.requisitionId,
          templateId: data.templateId,
          contentMd: data.contentMd,
          status: data.status,
        };
        inMemoryProposals.set(id, proposal);
        return Promise.resolve(proposal);
      }),
    },
  },
}));

describe('Async Flow Integration (API -> BullMQ Queue -> Worker Consumer -> State Machine)', () => {
  const publishedEvents: Array<{ channel: string; message: string }> = [];

  const mockRedis = {
    publish: jest.fn((channel: string, message: string) => {
      publishedEvents.push({ channel, message });
      return Promise.resolve(1);
    }),
  } as unknown as IORedis;

  beforeEach(() => {
    inMemoryRequisitions.clear();
    inMemoryProposals.clear();
    publishedEvents.length = 0;
    jest.clearAllMocks();
  });

  it('should execute full end-to-end async workflow: GENERATING -> LLM Scope -> Save Proposal -> AWAITING_SCOPE -> Redis Event', async () => {
    // 1. Initial State: Requisition created by API
    const reqId = 'req-async-001';
    const userId = 'user-dev-999';

    inMemoryRequisitions.set(reqId, {
      id: reqId,
      userId,
      originalPrompt: 'Build a Next.js full-stack analytics dashboard',
      status: 'AWAITING_SCOPE',
    });

    // 2. Simulated LLM structured response
    const mockLlmResponse: ProposedScopeResponse = {
      projectGoal: 'Full-Stack Analytics Dashboard with Next.js and Prisma',
      mustHave: ['Real-time metrics charts', 'User Authentication', 'CSV Export'],
      shouldHave: ['Dark mode toggle'],
      couldHave: ['Slack notifications integration'],
      wontHave: ['Mobile native apps'],
      businessConstraints: ['Deploy on Vercel', 'Monthly infrastructure budget < $30'],
    };
    mockInvoke.mockResolvedValue(mockLlmResponse);

    // 3. Worker receives Job from BullMQ queue
    const jobData: GenerationJobData = {
      projectRequest: {
        name: 'Analytics Dashboard',
        prompt: 'Build a Next.js full-stack analytics dashboard',
        artifacts: [ArtifactType.REQUIREMENTS, ArtifactType.ARCHITECTURE_DOC],
      },
      requisitionId: reqId,
      userId,
      threadId: 'thread-async-555',
    };

    // 4. Create simple graph runner invoking scopeAgent node
    const simulatedGraph = {
      invoke: async (state: any, config: RunnableConfig) => {
        return scopeAgent(state, config);
      },
    };

    // 5. Worker processes job
    const result: any = await processGenerationJob(
      { id: 'job-bullmq-777', data: jobData },
      simulatedGraph,
      mockRedis,
    );

    // 6. Assertions on the entire lifecycle:
    // A. Requisition status transitioned to AWAITING_SCOPE at end of scope generation
    const updatedReq = inMemoryRequisitions.get(reqId);
    expect(updatedReq?.status).toBe('AWAITING_SCOPE');

    // B. Scope proposal was created with Markdown
    expect(result.scopeProposalId).toBeDefined();
    const createdProposal = inMemoryProposals.get(result.scopeProposalId);
    expect(createdProposal).toBeDefined();
    expect(createdProposal?.contentMd).toContain('# Proposta de Escopo');
    expect(createdProposal?.contentMd).toContain('Full-Stack Analytics Dashboard with Next.js and Prisma');
    expect(createdProposal?.contentMd).toContain('Real-time metrics charts');

    // C. Redis Pub/Sub published real-time SSE events to user channel
    expect(publishedEvents.length).toBeGreaterThanOrEqual(2);
    expect(publishedEvents[0].channel).toBe(`USER_EVENTS_${userId}`);
    const startEvent = JSON.parse(publishedEvents[0].message);
    expect(startEvent.type).toBe('REQUISITION_STATUS_CHANGED');

    const scopeEvent = JSON.parse(publishedEvents[1].message);
    expect(scopeEvent.type).toBe('SCOPE_READY');
    expect(scopeEvent.requisitionId).toBe(reqId);
    expect(scopeEvent.data.proposal.id).toBe(result.scopeProposalId);
  });
});
