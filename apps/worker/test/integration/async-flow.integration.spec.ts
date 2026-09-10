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
  threadId?: string;
}

interface MockProposal {
  id: string;
  requisitionId: string;
  templateId: string;
  contentMd: string;
  status: string;
  userFeedback?: string | null;
}

interface MockArtifact {
  id: string;
  requisitionId: string;
  templateId: string;
  artifactType: string;
  fileName: string;
  generatedContent?: string | null;
  status: string;
}

const inMemoryRequisitions = new Map<string, MockRequisition>();
const inMemoryProposals = new Map<string, MockProposal>();
const inMemoryArtifacts = new Map<string, MockArtifact>();

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
        if (where.name === 'default_requirements') {
          return Promise.resolve({
            id: 'tmpl-req-prompt-001',
            name: where.name,
            content: 'Você é um Engenheiro de Requisitos de Software Sênior.',
          });
        }
        if (where.name === 'default_requirements_response') {
          return Promise.resolve({
            id: 'tmpl-req-response-001',
            name: where.name,
            content: '# Requisitos\n{{summary}}\n{{functionalRequirements}}\n{{nonFunctionalRequirements}}\n{{businessRules}}',
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
        const id = `prop-${Date.now()}-${Math.random()}`;
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
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        return Promise.resolve(inMemoryProposals.get(where.id) ?? null);
      }),
      findFirst: jest.fn(({ where }: { where: { requisitionId: string; status?: string } }) => {
        for (const p of inMemoryProposals.values()) {
          if (p.requisitionId === where.requisitionId && (!where.status || p.status === where.status)) {
            return Promise.resolve(p);
          }
        }
        return Promise.resolve(null);
      }),
    },
    artifact: {
      findFirst: jest.fn(({ where }: { where: { requisitionId: string; artifactType: string } }) => {
        for (const a of inMemoryArtifacts.values()) {
          if (a.requisitionId === where.requisitionId && a.artifactType === where.artifactType) {
            return Promise.resolve(a);
          }
        }
        return Promise.resolve(null);
      }),
      create: jest.fn(({ data }: { data: any }) => {
        const id = `art-${Date.now()}`;
        const artifact: MockArtifact = {
          id,
          requisitionId: data.requisitionId,
          templateId: data.templateId,
          artifactType: data.artifactType,
          fileName: data.fileName,
          status: data.status,
        };
        inMemoryArtifacts.set(id, artifact);
        return Promise.resolve(artifact);
      }),
      updateMany: jest.fn(({ where, data }: { where: { requisitionId: string; artifactType: string }; data: any }) => {
        let count = 0;
        for (const a of inMemoryArtifacts.values()) {
          if (a.requisitionId === where.requisitionId && a.artifactType === where.artifactType) {
            Object.assign(a, data);
            count++;
          }
        }
        return Promise.resolve({ count });
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
    inMemoryArtifacts.clear();
    publishedEvents.length = 0;
    jest.clearAllMocks();
  });

  it('should execute full end-to-end async workflow: GENERATING -> LLM Scope -> Save Proposal -> AWAITING_SCOPE -> Redis Event', async () => {
    const reqId = 'req-async-001';
    const userId = 'user-dev-999';

    inMemoryRequisitions.set(reqId, {
      id: reqId,
      userId,
      originalPrompt: 'Build a Next.js full-stack analytics dashboard',
      status: 'AWAITING_SCOPE',
    });

    const mockLlmResponse: ProposedScopeResponse = {
      projectGoal: 'Full-Stack Analytics Dashboard with Next.js and Prisma',
      mustHave: ['Real-time metrics charts', 'User Authentication', 'CSV Export'],
      shouldHave: ['Dark mode toggle'],
      couldHave: ['Slack notifications integration'],
      wontHave: ['Mobile native apps'],
      businessConstraints: ['Deploy on Vercel', 'Monthly infrastructure budget < $30'],
    };
    mockInvoke.mockResolvedValue(mockLlmResponse);

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

    const simulatedGraph = {
      invoke: async (state: any, config: RunnableConfig) => {
        return scopeAgent(state, config);
      },
    };

    const result: any = await processGenerationJob(
      { id: 'job-bullmq-777', data: jobData },
      simulatedGraph,
      mockRedis,
    );

    const updatedReq = inMemoryRequisitions.get(reqId);
    expect(updatedReq?.status).toBe('AWAITING_SCOPE');

    expect(result.scopeProposalId).toBeDefined();
    const createdProposal = inMemoryProposals.get(result.scopeProposalId);
    expect(createdProposal).toBeDefined();
    expect(createdProposal?.contentMd).toContain('# Proposta de Escopo');
    expect(createdProposal?.contentMd).toContain('Full-Stack Analytics Dashboard with Next.js and Prisma');

    expect(publishedEvents.length).toBeGreaterThanOrEqual(2);
    expect(publishedEvents[0].channel).toBe(`USER_EVENTS_${userId}`);
    const startEvent = JSON.parse(publishedEvents[0].message);
    expect(startEvent.type).toBe('REQUISITION_STATUS_CHANGED');

    const scopeEvent = JSON.parse(publishedEvents[1].message);
    expect(scopeEvent.type).toBe('SCOPE_READY');
    expect(scopeEvent.requisitionId).toBe(reqId);
  });

  it('should support full HITL rejection and refinement loop via process-hitl job', async () => {
    const reqId = 'req-hitl-002';
    const userId = 'user-hitl-888';

    inMemoryRequisitions.set(reqId, {
      id: reqId,
      userId,
      originalPrompt: 'Build an invoice management system',
      status: 'AWAITING_SCOPE',
      threadId: 'thread-hitl-888',
    });

    const refinedLlmResponse: ProposedScopeResponse = {
      projectGoal: 'Invoice Management MVP with Automated Reminders',
      mustHave: ['Invoice PDF generation', 'Email reminders'],
      shouldHave: ['Multi-currency'],
      couldHave: ['Custom branding'],
      wontHave: ['Crypto payments'],
      businessConstraints: ['SaaS multi-tenant'],
    };
    mockInvoke.mockResolvedValue(refinedLlmResponse);

    let capturedGraphState: any = {
      projectRequest: {
        name: 'Invoice Management',
        prompt: 'Build an invoice management system',
        artifacts: [ArtifactType.REQUIREMENTS],
      },
      requisitionId: reqId,
      userId,
      scopeProposalId: 'prop-initial',
    };

    const simulatedGraph = {
      updateState: jest.fn((_cfg: any, values: any) => {
        capturedGraphState = { ...capturedGraphState, ...values };
        return Promise.resolve();
      }),
      invoke: jest.fn((_input: any, config: RunnableConfig) => {
        return scopeAgent(capturedGraphState, config);
      }),
    };

    const rejectJob: GenerationJobData = {
      requisitionId: reqId,
      userId,
      threadId: 'thread-hitl-888',
      action: 'REJECT',
      feedback: 'Please add automated email reminders to Must Have',
    };

    const result: any = await processGenerationJob(
      { id: 'job-hitl-reject-1', data: rejectJob },
      simulatedGraph,
      mockRedis,
    );

    expect(simulatedGraph.updateState).toHaveBeenCalledWith(
      expect.anything(),
      { scopeApproved: false, userFeedback: 'Please add automated email reminders to Must Have' },
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('Please add automated email reminders to Must Have'),
    );
    expect(result.scopeProposalId).toBeDefined();

    const scopeEvents = publishedEvents.filter(
      (e) => JSON.parse(e.message).type === 'SCOPE_READY',
    );
    expect(scopeEvents.length).toBe(1);
  });
});
